begin;

alter table public.appointments drop constraint if exists appointments_type_check;
alter table public.appointments add constraint appointments_type_check
  check (appointment_type in ('MEETING','VISIT','ESTIMATION','CALL','FOLLOW_UP','SIGNATURE'));

alter table public.appointments add column if not exists agenda_details jsonb not null default '{}';
alter table public.appointments add column if not exists agenda_reminder_minutes integer check (agenda_reminder_minutes between 0 and 10080);
alter table public.estimations add column if not exists agenda_details jsonb not null default '{}';
alter table public.estimations add column if not exists agenda_reminder_minutes integer check (agenda_reminder_minutes between 0 and 10080);
alter table public.tasks add column if not exists agenda_details jsonb not null default '{}';
alter table public.tasks add column if not exists agenda_reminder_minutes integer check (agenda_reminder_minutes between 0 and 10080);

create index if not exists agenda_appointments_owner_date on public.appointments(assigned_to, starts_at, id);
create index if not exists agenda_estimations_owner_date on public.estimations(assigned_to, appointment_at, id) where not archived and appointment_at is not null;
create index if not exists agenda_tasks_owner_date on public.tasks(assigned_to, due_at, id);
create unique index if not exists agenda_generated_visit_followup on public.tasks(appointment_id)
  where agenda_details->>'origin' = 'visit_follow_up';

create table if not exists public.agenda_requests (
  actor_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null,
  payload_digest text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (actor_id, request_id)
);
alter table public.agenda_requests enable row level security;
revoke all on public.agenda_requests from public, anon, authenticated;
grant select, insert on public.agenda_requests to service_role;

create or replace function public.sync_agenda_visit_followup()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.appointment_type <> 'VISIT' then return new; end if;
  if new.agenda_details->>'nextDayFollowup' is distinct from 'true' or new.visit_status = 'CANCELLED' then
    update public.tasks set status = 'CANCELLED'
    where appointment_id = new.id and agenda_details->>'origin' = 'visit_follow_up' and status in ('TODO','IN_PROGRESS');
    return new;
  end if;

  insert into public.tasks(appointment_id, lead_id, contact_id, property_id, assigned_to, title, due_at, task_type, agenda_details)
  values (new.id, new.lead_id, new.contact_id, new.property_id, new.assigned_to, 'Relance après visite · ' || new.title,
    (((new.starts_at at time zone 'Europe/Paris')::date + 1) + time '09:00') at time zone 'Europe/Paris',
    'FOLLOW_UP', '{"origin":"visit_follow_up"}')
  on conflict (appointment_id) where agenda_details->>'origin' = 'visit_follow_up'
  do update set due_at = excluded.due_at, assigned_to = excluded.assigned_to, contact_id = excluded.contact_id,
    property_id = excluded.property_id, title = excluded.title
  where public.tasks.status in ('TODO','IN_PROGRESS');
  return new;
end
$$;

drop trigger if exists sync_agenda_visit_followup on public.appointments;
create trigger sync_agenda_visit_followup after insert or update of starts_at, assigned_to, visit_status, agenda_details, contact_id, property_id
  on public.appointments for each row execute function public.sync_agenda_visit_followup();

create or replace function public.reset_estimation_agenda_status()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.appointment_at is distinct from old.appointment_at and new.agenda_details = old.agenda_details then
    new.agenda_details := new.agenda_details - 'state' - 'cancelReason';
  end if;
  return new;
end
$$;
drop trigger if exists reset_estimation_agenda_status on public.estimations;
create trigger reset_estimation_agenda_status before update of appointment_at on public.estimations
  for each row execute function public.reset_estimation_agenda_status();

create or replace function public.apply_agenda_mutation(actor_key uuid, request_key uuid, payload jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  event public.appointments%rowtype;
  estimate public.estimations%rowtype;
  task public.tasks%rowtype;
  prior public.agenda_requests%rowtype;
  data jsonb := coalesce(payload->'entry', payload);
  operation text := payload->>'operation';
  source text := data->>'source';
  entry_type text := data->>'type';
  entry_id uuid := nullif(data->>'id', '')::uuid;
  expected timestamptz := nullif(payload->>'expectedUpdatedAt', '')::timestamptz;
  staff uuid := nullif(data->>'assigneeId', '')::uuid;
  starts timestamptz := nullif(data->>'startsAt', '')::timestamptz;
  ends timestamptz := nullif(data->>'endsAt', '')::timestamptz;
  due timestamptz := nullif(data->>'dueAt', '')::timestamptz;
  contact uuid := nullif(data->>'contactId', '')::uuid;
  property uuid := nullif(data->>'propertyId', '')::uuid;
  appointment uuid := nullif(data->>'appointmentId', '')::uuid;
  details jsonb := coalesce(data->'details', '{}');
  seller uuid := nullif(details->>'sellerId', '')::uuid;
  reminder integer := nullif(data->>'reminderMinutes', '')::integer;
  original_staff uuid;
  original_revision timestamptz;
  original_status text;
  original_details jsonb;
  original_reminder integer;
  original_at timestamptz;
  reminder_at timestamptz;
  display_name text;
  team_access boolean;
  result jsonb;
  conflict jsonb;
begin
  select * into actor from public.profiles where id = actor_key and is_active;
  if not found or actor.role not in ('ADMIN','DIRECTOR','AGENT','ASSISTANT') then
    return jsonb_build_object('error','forbidden');
  end if;
  team_access := actor.role in ('ADMIN','DIRECTOR');
  display_name := coalesce(actor.full_name, actor.email, 'Utilisateur CRM');
  perform pg_advisory_xact_lock(hashtextextended('agenda-request:' || actor_key::text || ':' || request_key::text, 0));
  select * into prior from public.agenda_requests r where r.actor_id = actor_key and r.request_id = request_key;
  if found then
    return case when prior.payload_digest = encode(sha256(convert_to(payload::text, 'UTF8')), 'hex')
      then prior.result else jsonb_build_object('error','idempotency') end;
  end if;

  if entry_id is not null then
    if source = 'appointment' then
      select * into event from public.appointments where id = entry_id for update;
      if found then
        original_staff := event.assigned_to; original_revision := event.updated_at;
        original_status := case when event.appointment_type='VISIT' then lower(event.visit_status) else lower(event.status) end;
        original_details := event.agenda_details; original_at := event.starts_at; original_reminder := event.agenda_reminder_minutes;
      end if;
    elsif source = 'estimation' then
      select * into estimate from public.estimations where id = entry_id and not archived for update;
      if found then
        original_staff := estimate.assigned_to; original_revision := estimate.updated_at;
        original_status := coalesce(estimate.agenda_details->>'state',
          case when estimate.commercial_status in ('COMPLETED','REPORT_SENT','FINISHED') then 'completed' when estimate.commercial_status='NO_FOLLOW_UP' then 'cancelled' else 'scheduled' end);
        original_details := estimate.agenda_details; original_at := estimate.appointment_at; original_reminder := estimate.agenda_reminder_minutes;
      end if;
    elsif source = 'task' then
      select * into task from public.tasks where id = entry_id for update;
      if found then
        original_staff := task.assigned_to; original_revision := task.updated_at;
        original_status := case when task.completed_at is not null then 'completed' else lower(task.status) end;
        original_details := task.agenda_details; original_at := task.due_at; original_reminder := task.agenda_reminder_minutes;
      end if;
    end if;
    if original_revision is null then return jsonb_build_object('error','missing'); end if;
    if not team_access and original_staff is distinct from actor_key then return jsonb_build_object('error','forbidden'); end if;
    if original_revision is distinct from expected then return jsonb_build_object('error','stale'); end if;
  elsif operation <> 'save' or source = 'estimation' then
    return jsonb_build_object('error','invalid');
  end if;

  if operation = 'save' then
    if staff is null or (not team_access and staff <> actor_key)
      or not exists(select 1 from public.profiles p where p.id=staff and p.is_active and p.role in ('ADMIN','DIRECTOR','AGENT','ASSISTANT')) then
      return jsonb_build_object('error','assignee');
    end if;
    if original_status in ('completed','cancelled','missed','no_show','done')
      and not (source='estimation' and original_status='cancelled' and estimate.commercial_status='TO_CONTACT') then
      return jsonb_build_object('error','state');
    end if;
    if source = 'estimation' then
      contact := estimate.contact_id;
    end if;
    if contact is not null and not exists(
      select 1 from public.contacts c where c.id=contact and not c.archived and (team_access or c.assigned_to=actor_key)
    ) then return jsonb_build_object('error','contact'); end if;
    if seller is not null and not exists(
      select 1 from public.contacts c where c.id=seller and not c.archived and (team_access or c.assigned_to=actor_key)
    ) then return jsonb_build_object('error','contact'); end if;
    if entry_type='FOLLOW_UP' and not exists (
      select 1 from public.contacts c where c.id=contact and
        (case when details->>'channel'='email' then length(btrim(coalesce(c.email,''))) > 0
          else length(btrim(coalesce(c.phone,''))) > 0 end)
    ) then return jsonb_build_object('error','coordinate'); end if;
    if entry_type='SIGNATURE' and seller=contact then return jsonb_build_object('error','invalid'); end if;
    if property is not null and not exists(
      select 1 from public.properties p where p.id=property and p.archived_at is null
    ) then return jsonb_build_object('error','property'); end if;
    if source='appointment' and event.id is not null and (event.appointment_type<>entry_type
      or (event.lead_id is not null and event.contact_id is distinct from contact)) then
      return jsonb_build_object('error','linked');
    end if;
    if source='task' and appointment is not null and not exists(
      select 1 from public.appointments a where a.id=appointment and (team_access or a.assigned_to=actor_key)
    ) then return jsonb_build_object('error','linked'); end if;

    reminder_at := case when source='task' then due else starts end;
    if reminder is not null and (reminder_at is null or reminder_at - make_interval(mins=>reminder) <= now())
      and (original_at is distinct from reminder_at or original_reminder is distinct from reminder) then
      return jsonb_build_object('error','reminder_past');
    end if;

    if source in ('appointment','estimation') then
      if starts is null or ends is null or starts >= ends or ends-starts > interval '7 days' then
        return jsonb_build_object('error','invalid');
      end if;
      if source='estimation' and ends-starts > interval '8 hours' then return jsonb_build_object('error','duration'); end if;
      perform pg_advisory_xact_lock(hashtextextended('agenda-assignee:' || staff::text, 0));
      if coalesce((payload->>'acceptConflict')::boolean,false) is false then
        select jsonb_build_object('startsAt', starts_at, 'endsAt', ends_at)
        into conflict from (
          select a.starts_at, coalesce(a.ends_at, a.starts_at + interval '30 minutes') as ends_at
          from public.appointments a
          where a.assigned_to=staff and not (source='appointment' and a.id is not distinct from entry_id)
            and (case when a.appointment_type='VISIT' then a.visit_status in ('TO_CONFIRM','CONFIRMED')
                      else lower(a.status) not in ('cancelled','completed','done','missed','no_show') end)
            and a.starts_at < ends and coalesce(a.ends_at, a.starts_at + interval '30 minutes') > starts
          union all
          select e.appointment_at, e.appointment_at + make_interval(mins=>coalesce(e.duration_minutes,60))
          from public.estimations e
          where e.assigned_to=staff and not e.archived and e.appointment_at is not null
            and e.commercial_status not in ('COMPLETED','REPORT_SENT','FINISHED','NO_FOLLOW_UP')
            and coalesce(e.agenda_details->>'state','') not in ('completed','cancelled')
            and not (source='estimation' and e.id is not distinct from entry_id)
            and e.appointment_at < ends and e.appointment_at + make_interval(mins=>coalesce(e.duration_minutes,60)) > starts
        ) overlapping_slots order by starts_at limit 1;
        if conflict is not null then return jsonb_build_object('error','overlap','conflict',conflict); end if;
      end if;
    end if;

    if source='appointment' then
      if event.id is null and entry_type='VISIT' then
        entry_id := public.create_commercial_visit(property, contact, null, staff, starts, ends, data->>'location', data->>'notes', actor_key, display_name);
        update public.appointments set title=coalesce(nullif(data->>'title',''),title), agenda_details=details, agenda_reminder_minutes=reminder where id=entry_id;
      elsif event.id is null then
        insert into public.appointments(appointment_type, title, contact_id, property_id, assigned_to, starts_at, ends_at, location, comment, agenda_details, agenda_reminder_minutes)
        values (entry_type,data->>'title',contact,property,staff,starts,ends,nullif(data->>'location',''),nullif(data->>'notes',''),details,reminder)
        returning id into entry_id;
      else
        update public.appointments set title=coalesce(nullif(data->>'title',''),event.title), contact_id=contact, property_id=property,
          assigned_to=staff, starts_at=starts, ends_at=ends, location=nullif(data->>'location',''),
          comment=nullif(data->>'notes',''), agenda_details=details, agenda_reminder_minutes=reminder
        where id=entry_id;
      end if;
    elsif source='estimation' then
      update public.estimations set appointment_at=starts, duration_minutes=extract(epoch from ends-starts)::int/60,
        appointment_location=coalesce(nullif(data->>'location',''),estimate.property_address),
        time_slot=to_char(starts at time zone 'Europe/Paris','DD/MM/YYYY HH24:MI'),
        assigned_to=staff, notes=nullif(data->>'notes',''), commercial_status='SCHEDULED',
        agenda_details=details, agenda_reminder_minutes=reminder, updated_at=now()
      where id=entry_id;
    elsif source='task' then
      if task.id is null then
        insert into public.tasks(title, description, contact_id, property_id, appointment_id, assigned_to, created_by, due_at, priority, task_type, agenda_reminder_minutes)
        values(data->>'title', nullif(data->>'notes',''), contact, property, appointment, staff, actor_key, due, data->>'priority', data->>'taskType', reminder)
        returning id into entry_id;
      else
        update public.tasks set title=data->>'title', description=nullif(data->>'notes',''), contact_id=contact, property_id=property,
          assigned_to=staff, due_at=due, priority=data->>'priority', task_type=data->>'taskType', agenda_reminder_minutes=reminder,
          email_reminder_scheduled_at=case when email_reminder_enabled and email_reminder_sent_at is null then due else email_reminder_scheduled_at end
        where id=entry_id;
      end if;
    else return jsonb_build_object('error','invalid');
    end if;
  elsif operation = 'reminder' then
    if original_status in ('completed','cancelled','missed','no_show','done') then return jsonb_build_object('error','state'); end if;
    if reminder is not null and (original_at is null or original_at - make_interval(mins=>reminder) <= now()) then
      return jsonb_build_object('error','reminder_past');
    end if;
    if source='appointment' then update public.appointments set agenda_reminder_minutes=reminder where id=entry_id;
    elsif source='estimation' then update public.estimations set agenda_reminder_minutes=reminder,updated_at=now() where id=entry_id;
    else update public.tasks set agenda_reminder_minutes=reminder where id=entry_id;
    end if;
  elsif operation in ('complete','cancel','reopen') then
    if operation='reopen' then
      if source<>'task' or original_status<>'completed' then return jsonb_build_object('error','state'); end if;
    elsif original_status in ('completed','cancelled','missed','no_show','done') or
      (operation='cancel' and payload->>'confirm' is distinct from 'true') or
      (operation='complete' and source<>'task' and original_at > now()) then
      return jsonb_build_object('error','state');
    end if;
    details := original_details || jsonb_strip_nulls(jsonb_build_object('cancelReason',nullif(payload->>'reason','')));
    if source='appointment' then
      if event.appointment_type='VISIT' then
        perform public.update_commercial_visit(entry_id,'SET_STATUS',case when operation='complete' then 'COMPLETED' else 'CANCELLED' end,null,null,actor_key,display_name);
      end if;
      update public.appointments set status=case when operation='complete' then 'completed' else 'cancelled' end,
        agenda_reminder_minutes=null, agenda_details=details where id=entry_id;
    elsif source='estimation' then
      update public.estimations set agenda_details=details || jsonb_build_object('state',case when operation='complete' then 'completed' else 'cancelled' end),
        agenda_reminder_minutes=null, commercial_status=case when operation='cancel' and commercial_status='SCHEDULED' then 'TO_CONTACT' else commercial_status end,
        updated_at=now() where id=entry_id;
    else
      update public.tasks set status=case operation when 'complete' then 'COMPLETED' when 'reopen' then 'TODO' else 'CANCELLED' end,
        completed_at=case when operation='complete' then now() else null end,
        completed_by=case when operation='complete' then actor_key else null end,
        agenda_reminder_minutes=null, agenda_details=details,
        email_reminder_enabled=false, email_reminder_scheduled_at=null,
        email_reminder_status=case when email_reminder_sent_at is null then 'NOT_SCHEDULED' else email_reminder_status end
      where id=entry_id;
    end if;
  elsif operation='delete' then
    if not team_access or payload->>'confirm' is distinct from 'true' then return jsonb_build_object('error','forbidden'); end if;
    if source='estimation' or (source='appointment' and (event.appointment_type in ('VISIT','ESTIMATION') or event.lead_id is not null
      or exists(select 1 from public.tasks where appointment_id=entry_id))) or
      (source='task' and (task.lead_id is not null or task.offer_id is not null or task.appointment_id is not null)) then
      return jsonb_build_object('error','linked');
    end if;
    if source='appointment' then delete from public.appointments where id=entry_id;
    else delete from public.tasks where id=entry_id;
    end if;
  else return jsonb_build_object('error','invalid');
  end if;

  result := jsonb_build_object('id',entry_id,'source',source,'operation',operation);
  if operation <> 'delete' then
    insert into public.activities(entity_type,entity_id,action,user_name,actor_id,metadata)
    values(source,entry_id::text,
      case operation when 'save' then 'Activité planifiée dans l’agenda' when 'complete' then 'Activité terminée'
        when 'cancel' then 'Activité annulée' when 'reopen' then 'Tâche rouverte' else 'Rappel interne modifié' end,
      display_name,actor_key,jsonb_strip_nulls(jsonb_build_object('contact_id',contact,'property_id',property,'starts_at',starts)));
  end if;
  insert into public.agenda_requests(actor_id,request_id,payload_digest,result)
  values(actor_key,request_key,encode(sha256(convert_to(payload::text, 'UTF8')), 'hex'),result);
  insert into public.audit_logs(actor_id,actor_email,actor_role,action,entity_type,entity_id,metadata)
  values(actor_key,actor.email,actor.role,'agenda.'||operation,source,entry_id::text,
    jsonb_strip_nulls(jsonb_build_object('previousDate',original_at,'startsAt',starts,'dueAt',due,'assigneeId',staff,'previousAssigneeId',original_staff)));
  return result;
end
$$;
revoke all on function public.apply_agenda_mutation(uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.apply_agenda_mutation(uuid,uuid,jsonb) to service_role;

commit;
