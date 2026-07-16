-- IMMO-DREAMS83 V3
-- Secure CRM foundation: admin profiles, audit logs, property history,
-- photo trash, normalized lead foundations and future commercial tables.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'admin_role') then
    create type admin_role as enum (
      'ADMIN',
      'DIRECTOR',
      'AGENT',
      'ASSISTANT',
      'MARKETING',
      'READ_ONLY'
    );
  end if;
end
$$;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  role admin_role not null default 'READ_ONLY',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid references profiles(id) on delete set null,
  actor_email text not null,
  actor_role admin_role,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists property_versions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties(id) on delete cascade,
  reference text not null,
  snapshot jsonb not null,
  changed_by uuid references profiles(id) on delete set null,
  change_reason text not null default 'admin.update',
  created_at timestamptz not null default now()
);

create table if not exists property_photo_trash (
  id uuid primary key default gen_random_uuid(),
  storage_bucket text not null default 'property-photos',
  storage_path text not null,
  public_url text not null,
  deleted_by uuid references profiles(id) on delete set null,
  delete_reason text not null default 'removed_from_property_gallery',
  deleted_at timestamptz not null default now(),
  restore_until timestamptz not null default (now() + interval '30 days'),
  restored_at timestamptz,
  purged_at timestamptz
);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id) on delete set null,
  estimation_id uuid references estimations(id) on delete set null,
  linked_property_id uuid references properties(id) on delete set null,
  source_table text,
  source_id text,
  lead_type text not null default 'general',
  source text not null default 'site_public',
  priority text not null default 'normal',
  assigned_to uuid references profiles(id) on delete set null,
  status text not null default 'NEW',
  notes text,
  archived boolean not null default false,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists lead_status_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  previous_status text,
  next_status text not null,
  changed_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  assigned_to uuid references profiles(id) on delete set null,
  title text not null,
  description text,
  due_at timestamptz,
  completed_at timestamptz,
  priority text not null default 'normal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists communications (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  channel text not null,
  direction text not null default 'outbound',
  subject text,
  body text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  property_id uuid references properties(id) on delete set null,
  assigned_to uuid references profiles(id) on delete set null,
  title text not null,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists mandates (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties(id) on delete set null,
  lead_id uuid references leads(id) on delete set null,
  mandate_number text not null unique,
  mandate_type text not null default 'simple',
  status text not null default 'draft',
  signed_at date,
  expires_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists buyer_searches (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id) on delete cascade,
  assigned_to uuid references profiles(id) on delete set null,
  property_types text[] not null default '{}',
  cities text[] not null default '{}',
  max_budget numeric,
  min_surface numeric,
  min_rooms numeric,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists match_suggestions (
  id uuid primary key default gen_random_uuid(),
  buyer_search_id uuid references buyer_searches(id) on delete cascade,
  property_id uuid references properties(id) on delete cascade,
  score numeric not null default 0,
  reasons jsonb not null default '[]'::jsonb,
  status text not null default 'suggested',
  created_at timestamptz not null default now()
);

create table if not exists email_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete set null,
  provider text not null,
  template_key text,
  recipient text not null,
  subject text not null,
  status text not null default 'queued',
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  source text not null default 'manual',
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists portal_exports (
  id uuid primary key default gen_random_uuid(),
  portal_name text not null,
  export_type text not null default 'draft',
  status text not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists portal_export_logs (
  id uuid primary key default gen_random_uuid(),
  portal_export_id uuid references portal_exports(id) on delete cascade,
  level text not null default 'info',
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from profiles
    where id = auth.uid()
      and is_active = true
  );
$$;

drop trigger if exists profiles_set_updated_at on profiles;
create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

drop trigger if exists leads_set_updated_at on leads;
create trigger leads_set_updated_at
  before update on leads
  for each row execute function set_updated_at();

drop trigger if exists tasks_set_updated_at on tasks;
create trigger tasks_set_updated_at
  before update on tasks
  for each row execute function set_updated_at();

drop trigger if exists appointments_set_updated_at on appointments;
create trigger appointments_set_updated_at
  before update on appointments
  for each row execute function set_updated_at();

drop trigger if exists mandates_set_updated_at on mandates;
create trigger mandates_set_updated_at
  before update on mandates
  for each row execute function set_updated_at();

drop trigger if exists buyer_searches_set_updated_at on buyer_searches;
create trigger buyer_searches_set_updated_at
  before update on buyer_searches
  for each row execute function set_updated_at();

drop trigger if exists portal_exports_set_updated_at on portal_exports;
create trigger portal_exports_set_updated_at
  before update on portal_exports
  for each row execute function set_updated_at();

create index if not exists profiles_role_idx on profiles(role);
create index if not exists audit_logs_created_at_idx on audit_logs(created_at desc);
create index if not exists property_versions_reference_idx on property_versions(reference, created_at desc);
create index if not exists property_photo_trash_deleted_at_idx on property_photo_trash(deleted_at desc);
create index if not exists leads_status_idx on leads(status);
create index if not exists leads_assigned_to_idx on leads(assigned_to);
create index if not exists tasks_due_at_idx on tasks(due_at);
create index if not exists communications_lead_id_idx on communications(lead_id);
create index if not exists appointments_starts_at_idx on appointments(starts_at);
create index if not exists buyer_searches_status_idx on buyer_searches(status);

alter table profiles enable row level security;
alter table audit_logs enable row level security;
alter table property_versions enable row level security;
alter table property_photo_trash enable row level security;
alter table leads enable row level security;
alter table lead_status_history enable row level security;
alter table tasks enable row level security;
alter table communications enable row level security;
alter table appointments enable row level security;
alter table mandates enable row level security;
alter table buyer_searches enable row level security;
alter table match_suggestions enable row level security;
alter table email_events enable row level security;
alter table analytics_snapshots enable row level security;
alter table portal_exports enable row level security;
alter table portal_export_logs enable row level security;

drop policy if exists "Admins can read own profile" on profiles;
create policy "Admins can read own profile"
  on profiles for select to authenticated
  using (id = auth.uid());

drop policy if exists "Active admins can read contacts" on contacts;
create policy "Active admins can read contacts"
  on contacts for select to authenticated
  using (public.is_active_admin());

drop policy if exists "Active admins can read estimations" on estimations;
create policy "Active admins can read estimations"
  on estimations for select to authenticated
  using (public.is_active_admin());

drop policy if exists "Active admins can read CRM properties" on properties;
create policy "Active admins can read CRM properties"
  on properties for select to authenticated
  using (public.is_active_admin());

drop policy if exists "Active admins can read activities" on activities;
create policy "Active admins can read activities"
  on activities for select to authenticated
  using (public.is_active_admin());

drop policy if exists "Active admins can read audit logs" on audit_logs;
create policy "Active admins can read audit logs"
  on audit_logs for select to authenticated
  using (public.is_active_admin());

drop policy if exists "Active admins can read property versions" on property_versions;
create policy "Active admins can read property versions"
  on property_versions for select to authenticated
  using (public.is_active_admin());

drop policy if exists "Active admins can read photo trash" on property_photo_trash;
create policy "Active admins can read photo trash"
  on property_photo_trash for select to authenticated
  using (public.is_active_admin());
