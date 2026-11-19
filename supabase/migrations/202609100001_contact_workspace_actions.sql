-- Contact task/activity mutations and their audit are one transaction.
create or replace function public.contact_workspace_action(
  p_contact_id uuid, p_actor_id uuid, p_action jsonb
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_actor profiles%rowtype;
  v_contact contacts%rowtype;
  v_task tasks%rowtype;
  v_project leads%rowtype;
  v_id uuid;
  v_owner uuid;
  v_label text;
  v_kind text := p_action->>'action';
begin
  select * into v_actor from profiles where id = p_actor_id and is_active;
  if not found or v_actor.role not in ('ADMIN','DIRECTOR','AGENT','ASSISTANT') then
    raise exception 'Contact write permission required' using errcode = '42501';
  end if;
  select * into v_contact from contacts where id = p_contact_id for update;
  if not found then raise exception 'Contact not found' using errcode = 'P0002'; end if;
  if v_actor.role = 'AGENT' and v_contact.assigned_to is distinct from p_actor_id then
    raise exception 'Contact assignment required' using errcode = '42501';
  end if;
  if v_contact.archived then raise exception 'Restore contact before editing' using errcode = '23514'; end if;

  if v_kind = 'update-project' then
    select * into v_project from leads where id = (p_action->>'projectId')::uuid and contact_id = p_contact_id for update;
    if not found or (v_actor.role = 'AGENT' and v_project.assigned_to is distinct from p_actor_id) then raise exception 'Project access forbidden' using errcode = '42501'; end if;
    if (p_action->>'budgetMin')::numeric < 0 or (p_action->>'budgetMax')::numeric < 0 or (p_action->>'budgetMin')::numeric > (p_action->>'budgetMax')::numeric or jsonb_typeof(p_action->'financingApproved') is distinct from 'boolean' then raise exception 'Invalid project values' using errcode = '23514'; end if;
    update leads set budget_min = (p_action->>'budgetMin')::numeric, budget_max = (p_action->>'budgetMax')::numeric,
      financing_approved = (p_action->>'financingApproved')::boolean, city = nullif(trim(p_action->>'city'),''), notes = p_action->>'notes', updated_at = now()
      where id = v_project.id;
    v_id := v_project.id; v_label := 'Projet du contact mis à jour';
  elsif v_kind = 'create-task' then
    if length(trim(coalesce(p_action->>'title',''))) not between 2 and 200 or nullif(p_action->>'dueAt','') is null then
      raise exception 'Invalid task' using errcode = '23514';
    end if;
    v_owner := coalesce(nullif(p_action->>'assignedTo','')::uuid, v_contact.assigned_to, p_actor_id);
    if v_actor.role = 'AGENT' and v_owner <> p_actor_id then raise exception 'Assignment forbidden' using errcode = '42501'; end if;
    if not exists(select 1 from profiles where id = v_owner and is_active and role in ('ADMIN','DIRECTOR','AGENT','ASSISTANT')) then
      raise exception 'Invalid assignee' using errcode = '23514';
    end if;
    insert into tasks(contact_id, assigned_to, created_by, title, description, due_at, status, task_type)
    values(p_contact_id, v_owner, p_actor_id, trim(p_action->>'title'), p_action->>'description', (p_action->>'dueAt')::timestamptz, 'TODO', 'FOLLOW_UP') returning id into v_id;
    v_label := 'Tâche créée : ' || trim(p_action->>'title');
  elsif v_kind = 'complete-task' then
    select * into v_task from tasks where id = (p_action->>'taskId')::uuid for update;
    if not found or (v_task.contact_id is distinct from p_contact_id and not exists(select 1 from leads where id = v_task.lead_id and contact_id = p_contact_id)) then
      raise exception 'Task not linked to contact' using errcode = '42501';
    end if;
    if v_actor.role = 'AGENT' and v_task.assigned_to is distinct from p_actor_id then raise exception 'Task assignment required' using errcode = '42501'; end if;
    if v_task.status = 'CANCELLED' then raise exception 'Cancelled task' using errcode = '23514'; end if;
    if jsonb_typeof(p_action->'completed') is distinct from 'boolean' then raise exception 'Invalid completion' using errcode = '23514'; end if;
    update tasks set status = case when (p_action->>'completed')::boolean then 'COMPLETED' else 'TODO' end,
      completed_at = case when (p_action->>'completed')::boolean then now() else null end,
      completed_by = case when (p_action->>'completed')::boolean then p_actor_id else null end
    where id = v_task.id;
    v_id := v_task.id;
    v_label := case when (p_action->>'completed')::boolean then 'Tâche terminée : ' else 'Tâche rouverte : ' end || v_task.title;
  elsif v_kind = 'log-activity' then
    if p_action->>'kind' not in ('CALL','EMAIL','NOTE','MEETING') or length(trim(coalesce(p_action->>'description',''))) not between 2 and 4000 then
      raise exception 'Invalid activity' using errcode = '23514';
    end if;
    v_id := gen_random_uuid();
    v_label := case p_action->>'kind' when 'CALL' then 'Appel consigné' when 'EMAIL' then 'Email consigné' when 'MEETING' then 'Rendez-vous consigné' else 'Note de suivi' end;
    if p_action->>'kind' in ('CALL','EMAIL','MEETING') then update contacts set last_contacted_at = now() where id = p_contact_id; end if;
  else raise exception 'Unknown contact action' using errcode = '23514';
  end if;
  insert into activities(id, entity_type, entity_id, action, user_name, actor_id, metadata)
  values(case when v_kind = 'log-activity' then v_id else gen_random_uuid() end, 'contact', p_contact_id, v_label, coalesce(v_actor.full_name,v_actor.email), p_actor_id,
    jsonb_build_object('kind', coalesce(p_action->>'kind',case when v_kind = 'update-project' then 'PROJECT' else 'TASK' end), 'description', p_action->>'description', 'task_id', case when v_kind in ('create-task','complete-task') then v_id else null end));
  insert into audit_logs(actor_id, actor_email, actor_role, action, entity_type, entity_id, metadata)
  values(p_actor_id, v_actor.email, v_actor.role, 'contact.' || v_kind, 'contact', p_contact_id, jsonb_build_object('result_id',v_id));
  return v_id;
end;
$$;
revoke all on function public.contact_workspace_action(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.contact_workspace_action(uuid, uuid, jsonb) to service_role;

-- Keep duplicate keys synchronized for every entry point, including public forms.
create or replace function public.sync_contact_duplicate_keys()
returns trigger language plpgsql set search_path = public as $$
begin
  new.normalized_email := case when lower(trim(coalesce(new.email,''))) like '%@legacy.immo-dreams83.local' then null else nullif(lower(trim(new.email)), '') end;
  new.normalized_phone := nullif(regexp_replace(coalesce(new.phone,''), '\D', '', 'g'), '');
  return new;
end;
$$;
drop trigger if exists sync_contact_duplicate_keys on public.contacts;
create trigger sync_contact_duplicate_keys before insert or update of email, phone on public.contacts
for each row execute function public.sync_contact_duplicate_keys();
update public.contacts set email = email where
  normalized_email is distinct from case when lower(trim(coalesce(email,''))) like '%@legacy.immo-dreams83.local' then null else nullif(lower(trim(email)), '') end
  or normalized_phone is distinct from nullif(regexp_replace(coalesce(phone,''), '\D', '', 'g'), '');

-- Add the relations introduced after the original merge procedure, atomically.
create or replace function public.merge_contact_workspace(p_primary uuid, p_secondary uuid, p_actor uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_actor profiles%rowtype; v_result uuid;
begin
  select * into v_actor from profiles where id = p_actor and is_active;
  if not found or v_actor.role not in ('ADMIN','DIRECTOR','AGENT','ASSISTANT') then raise exception 'Forbidden' using errcode = '42501'; end if;
  perform id from contacts where id in (p_primary, p_secondary) order by id for update;
  if v_actor.role = 'AGENT' and (select count(*) from contacts where id in (p_primary,p_secondary) and assigned_to = p_actor) <> 2 then raise exception 'Contact assignment required' using errcode = '42501'; end if;
  v_result := public.merge_crm_contacts(p_primary, p_secondary, p_actor, v_actor.email, null);
  update appointments set contact_id = p_primary where contact_id = p_secondary;
  update negotiations set buyer_contact_id = p_primary where buyer_contact_id = p_secondary;
  update negotiations set seller_contact_id = p_primary where seller_contact_id = p_secondary;
  update activities set entity_id = p_primary::text where entity_type = 'contact' and entity_id = p_secondary::text;
  insert into activities(entity_type,entity_id,action,user_name,actor_id,metadata)
  values('contact',p_primary,'Contacts fusionnés',coalesce(v_actor.full_name,v_actor.email),p_actor,jsonb_build_object('merged_contact_id',p_secondary));
  insert into audit_logs(actor_id,actor_email,actor_role,action,entity_type,entity_id,metadata)
  values(p_actor,v_actor.email,v_actor.role,'contact.merge','contact',p_primary,jsonb_build_object('merged_contact_id',p_secondary));
  return v_result;
end;
$$;
revoke all on function public.merge_contact_workspace(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.merge_contact_workspace(uuid,uuid,uuid) to service_role;
