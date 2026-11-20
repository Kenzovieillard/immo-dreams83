begin;

create table public.crm_agency_settings (
  id boolean primary key default true check (id),
  information jsonb not null check (jsonb_typeof(information) = 'object'),
  updated_at timestamptz not null default now()
);
create table public.crm_user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  preferences jsonb not null default '{}' check (jsonb_typeof(preferences) = 'object'),
  inbox_seen_at timestamptz
);
alter table public.crm_agency_settings enable row level security;
alter table public.crm_user_settings enable row level security;
revoke all on public.crm_agency_settings, public.crm_user_settings from public, anon, authenticated;
grant select, insert, update on public.crm_agency_settings, public.crm_user_settings to service_role;

create function public.save_crm_agency(p_actor uuid, p_information jsonb, p_expected timestamptz)
returns text language plpgsql set search_path = '' as $$
declare
  actor public.profiles%rowtype;
  current_revision timestamptz;
begin
  select * into actor from public.profiles where id = p_actor and is_active for share;
  if not found or actor.role not in ('ADMIN', 'DIRECTOR') then return 'forbidden'; end if;
  perform pg_catalog.pg_advisory_xact_lock(581798729);
  select updated_at into current_revision from public.crm_agency_settings where id = true;
  if current_revision is distinct from p_expected then return 'conflict'; end if;
  insert into public.crm_agency_settings(id, information, updated_at)
  values (true, p_information, clock_timestamp())
  on conflict (id) do update set information = excluded.information, updated_at = excluded.updated_at;
  insert into public.audit_logs(actor_id, actor_email, actor_role, action, entity_type, metadata)
  values (actor.id, actor.email, actor.role, 'settings.agency.updated', 'settings', '{}'::jsonb);
  return 'ok';
end;
$$;

create function public.update_crm_team_member(
  p_actor uuid, p_member uuid, p_name text, p_role public.admin_role,
  p_active boolean, p_expected timestamptz
) returns text language plpgsql set search_path = '' as $$
declare
  actor public.profiles%rowtype;
  member public.profiles%rowtype;
begin
  lock table public.profiles in share row exclusive mode;
  select * into actor from public.profiles where id = p_actor and is_active and role = 'ADMIN';
  if not found then return 'forbidden'; end if;
  select * into member from public.profiles where id = p_member;
  if not found then return 'missing'; end if;
  if member.updated_at is distinct from p_expected then return 'conflict'; end if;
  if p_actor = p_member and (not p_active or p_role <> actor.role) then return 'self'; end if;
  if member.role = 'ADMIN' and member.is_active and (not p_active or p_role <> 'ADMIN')
    and not exists (select 1 from public.profiles where role = 'ADMIN' and is_active and id <> member.id)
  then return 'last_admin'; end if;
  if member.full_name is not distinct from p_name and member.role = p_role and member.is_active = p_active then return 'ok'; end if;
  update public.profiles set full_name = p_name, role = p_role, is_active = p_active, updated_at = clock_timestamp()
  where id = p_member;
  insert into public.audit_logs(actor_id, actor_email, actor_role, action, entity_type, entity_id, metadata)
  values (actor.id, actor.email, actor.role, 'settings.user.updated', 'profile', member.id,
    jsonb_build_object('oldRole', member.role, 'role', p_role, 'active', p_active));
  return 'ok';
end;
$$;

create function public.read_crm_team(p_actor uuid)
returns table(id uuid, email text, full_name text, role public.admin_role, is_active boolean, updated_at timestamptz, last_sign_in_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.email, p.full_name, p.role, p.is_active, p.updated_at, u.last_sign_in_at
  from public.profiles p left join auth.users u on u.id = p.id
  where exists (select 1 from public.profiles a where a.id = p_actor and a.is_active and a.role in ('ADMIN','DIRECTOR'))
  order by p.is_active desc, p.full_name nulls last, p.id;
$$;

create function public.read_crm_sessions(p_actor uuid)
returns table(id uuid, created_at timestamptz, last_activity timestamptz, user_agent text)
language sql stable security definer set search_path = '' as $$
  select s.id, s.created_at, coalesce(s.refreshed_at, s.updated_at, s.created_at), left(s.user_agent, 220)
  from auth.sessions s
  where s.user_id = p_actor and (s.not_after is null or s.not_after > now())
    and exists (select 1 from public.profiles p where p.id = p_actor and p.is_active)
    and exists (select 1 from auth.refresh_tokens t where t.session_id = s.id and t.revoked = false)
  order by coalesce(s.refreshed_at, s.updated_at, s.created_at) desc
  limit 50;
$$;

create function public.import_crm_contacts(p_actor uuid, p_rows jsonb)
returns integer language plpgsql set search_path = '' as $$
declare
  actor public.profiles%rowtype;
  row_value record;
  inserted integer := 0;
  affected integer;
begin
  select * into actor from public.profiles where id = p_actor and is_active and role in ('ADMIN','DIRECTOR') for share;
  if not found then return -1; end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 200 then return -2; end if;
  perform pg_catalog.pg_advisory_xact_lock(581798730);
  for row_value in select * from jsonb_to_recordset(p_rows) as r(name text,email text,phone text,city text)
  loop
    insert into public.contacts(name,email,phone,city,request_type,status,contact_source,qualification_status,message)
    select row_value.name, row_value.email, nullif(row_value.phone,''), nullif(row_value.city,''), 'Autre', 'NEW','IMPORT_CSV','TO_REVIEW',''
    where not exists (select 1 from public.contacts c where lower(c.email) = lower(row_value.email) and c.canonical_contact_id is null
      or (nullif(regexp_replace(coalesce(row_value.phone,''),'\D','','g'),'') is not null
        and c.normalized_phone = regexp_replace(row_value.phone,'\D','','g') and c.canonical_contact_id is null));
    get diagnostics affected = row_count;
    inserted := inserted + affected;
  end loop;
  insert into public.audit_logs(actor_id, actor_email, actor_role, action, entity_type, metadata)
  values (actor.id, actor.email, actor.role, 'settings.contacts.imported', 'contact',
    jsonb_build_object('submitted', jsonb_array_length(p_rows), 'inserted', inserted));
  return inserted;
end;
$$;

revoke all on function public.save_crm_agency(uuid,jsonb,timestamptz),
  public.update_crm_team_member(uuid,uuid,text,public.admin_role,boolean,timestamptz),
  public.read_crm_team(uuid), public.read_crm_sessions(uuid), public.import_crm_contacts(uuid,jsonb)
  from public, anon, authenticated;
grant execute on function public.save_crm_agency(uuid,jsonb,timestamptz),
  public.update_crm_team_member(uuid,uuid,text,public.admin_role,boolean,timestamptz),
  public.read_crm_team(uuid), public.read_crm_sessions(uuid), public.import_crm_contacts(uuid,jsonb)
  to service_role;

commit;
