-- Presentation order only: no business status/date changes, no backfill.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table if not exists public.commercial_pipeline_order (
  lead_id uuid primary key references public.leads(id) on delete cascade,
  stage text not null,
  position integer not null check (position > 0)
);
alter table public.commercial_pipeline_order enable row level security;
revoke all on public.commercial_pipeline_order from public, anon, authenticated;
grant all on public.commercial_pipeline_order to service_role;

create or replace function public.clear_commercial_pipeline_order()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.pipeline_stage is distinct from old.pipeline_stage
     or new.pipeline_type is distinct from old.pipeline_type
     or new.archived is distinct from old.archived then
    delete from public.commercial_pipeline_order where lead_id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function public.clear_commercial_pipeline_order() from public, anon, authenticated;
create or replace trigger clear_commercial_pipeline_order_on_change
after update of pipeline_stage, pipeline_type, archived on public.leads
for each row execute function public.clear_commercial_pipeline_order();

create or replace function public.reorder_commercial_pipeline(
  p_lead_id uuid, p_target_id uuid, p_stage text, p_placement text,
  p_actor_id uuid
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  moving public.leads%rowtype;
  target public.leads%rowtype;
  actor public.profiles%rowtype;
  ordered_ids uuid[];
  next_ids uuid[] := '{}'::uuid[];
  item uuid;
begin
  if p_lead_id is null or p_target_id is null or p_lead_id = p_target_id
     or p_stage is null or p_placement is null or p_placement not in ('before', 'after') then
    raise exception 'COMMERCIAL_ORDER_INVALID';
  end if;
  select * into actor from public.profiles where id = p_actor_id and is_active = true;
  if not found or actor.role not in ('ADMIN', 'DIRECTOR', 'AGENT', 'ASSISTANT') then
    raise exception 'COMMERCIAL_ORDER_FORBIDDEN' using errcode = '42501';
  end if;
  -- Serialize ordering requests. Lead locks also protect against concurrent stage changes.
  perform pg_advisory_xact_lock(hashtextextended('commercial_pipeline_order', 0));
  perform id from public.leads
    where archived = false and coalesce(pipeline_stage, pipeline_type || '_NEW') = p_stage
    order by id for update;
  select * into moving from public.leads where id = p_lead_id and archived = false;
  select * into target from public.leads where id = p_target_id and archived = false;
  if moving.id is null or target.id is null then
    raise exception 'COMMERCIAL_CASE_NOT_FOUND';
  end if;
  if coalesce(moving.pipeline_stage, moving.pipeline_type || '_NEW') is distinct from p_stage
     or coalesce(target.pipeline_stage, target.pipeline_type || '_NEW') is distinct from p_stage
     or moving.pipeline_type is distinct from target.pipeline_type then
    raise exception 'COMMERCIAL_ORDER_STAGE_MISMATCH';
  end if;
  if actor.role = 'AGENT' and
     (moving.assigned_to is distinct from p_actor_id or target.assigned_to is distinct from p_actor_id) then
    raise exception 'COMMERCIAL_ORDER_FORBIDDEN' using errcode = '42501';
  end if;

  select array_agg(l.id order by o.position nulls last, l.updated_at desc, l.id)
  into ordered_ids
  from public.leads l
  left join public.commercial_pipeline_order o on o.lead_id = l.id and o.stage = p_stage
  where l.archived = false and l.pipeline_type = moving.pipeline_type
    and coalesce(l.pipeline_stage, l.pipeline_type || '_NEW') = p_stage;
  foreach item in array ordered_ids loop
    if item = p_lead_id then continue; end if;
    if item = p_target_id and p_placement = 'before' then next_ids := array_append(next_ids, p_lead_id); end if;
    next_ids := array_append(next_ids, item);
    if item = p_target_id and p_placement = 'after' then next_ids := array_append(next_ids, p_lead_id); end if;
  end loop;
  if next_ids = ordered_ids then return p_lead_id; end if;
  insert into public.commercial_pipeline_order(lead_id, stage, position)
    select id, p_stage, ordinality::integer from unnest(next_ids) with ordinality as ordered(id, ordinality)
    on conflict (lead_id) do update set stage = excluded.stage, position = excluded.position;
  insert into public.activities(entity_type, entity_id, action, user_name, actor_id, metadata)
    values ('lead', p_lead_id, 'Ordre du pipeline modifié', coalesce(actor.full_name, actor.email), p_actor_id,
      jsonb_build_object('target_id', p_target_id, 'placement', p_placement, 'stage', p_stage));
  return p_lead_id;
end;
$$;
revoke all on function public.reorder_commercial_pipeline(uuid, uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.reorder_commercial_pipeline(uuid, uuid, text, text, uuid) to service_role;
commit;
