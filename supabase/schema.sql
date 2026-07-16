-- IMMO-DREAMS83 V2.5
-- Schema re-executable pour les leads, estimations, biens, activite et photos.

create extension if not exists pgcrypto;

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  email text not null,
  phone text,
  request_type text not null,
  city text,
  message text not null,
  status text not null default 'NEW',
  notes text,
  archived boolean not null default false
);

create table if not exists estimations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  email text not null,
  phone text not null,
  property_type text not null,
  city text not null,
  postal_code text,
  surface numeric not null,
  rooms numeric,
  message text,
  status text not null default 'NEW',
  notes text,
  archived boolean not null default false
);

create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  reference text not null,
  mandate_number text,
  slug text not null,
  title text not null,
  type text not null,
  transaction_type text not null default 'sale',
  status text not null,
  city text not null,
  postal_code text not null,
  price numeric not null,
  fees_included boolean not null default true,
  surface numeric not null,
  land_surface numeric,
  rooms numeric,
  bedrooms numeric,
  bathrooms numeric,
  energy_class text,
  climate_class text,
  description_short text,
  description_long text,
  features jsonb not null default '[]'::jsonb,
  photos jsonb not null default '[]'::jsonb,
  featured boolean not null default false,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  entity_type text not null,
  entity_id text not null,
  action text not null,
  user_name text not null
);

alter table contacts add column if not exists updated_at timestamptz not null default now();
alter table contacts add column if not exists notes text;
alter table contacts add column if not exists archived boolean not null default false;

alter table estimations add column if not exists updated_at timestamptz not null default now();
alter table estimations add column if not exists notes text;
alter table estimations add column if not exists archived boolean not null default false;

alter table properties add column if not exists mandate_number text;
alter table properties add column if not exists transaction_type text not null default 'sale';
alter table properties add column if not exists fees_included boolean not null default true;
alter table properties add column if not exists land_surface numeric;
alter table properties add column if not exists bedrooms numeric;
alter table properties add column if not exists bathrooms numeric;
alter table properties add column if not exists source_url text;
alter table properties add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'contacts_status_check') then
    alter table contacts
      add constraint contacts_status_check
      check (status in ('NEW', 'CONTACTED', 'APPOINTMENT', 'MANDATE_SIGNED', 'LOST'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'estimations_status_check') then
    alter table estimations
      add constraint estimations_status_check
      check (status in ('NEW', 'CONTACTED', 'APPOINTMENT', 'MANDATE_SIGNED', 'LOST'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'properties_type_check') then
    alter table properties
      add constraint properties_type_check
      check (type in ('apartment', 'house', 'land'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'properties_transaction_type_check') then
    alter table properties
      add constraint properties_transaction_type_check
      check (transaction_type in ('sale'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'properties_status_check') then
    alter table properties
      add constraint properties_status_check
      check (status in ('available', 'under_offer', 'sold'));
  end if;
end
$$;

create unique index if not exists properties_reference_key on properties(reference);
create unique index if not exists properties_slug_key on properties(slug);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists contacts_set_updated_at on contacts;
create trigger contacts_set_updated_at
  before update on contacts
  for each row execute function set_updated_at();

drop trigger if exists estimations_set_updated_at on estimations;
create trigger estimations_set_updated_at
  before update on estimations
  for each row execute function set_updated_at();

drop trigger if exists properties_set_updated_at on properties;
create trigger properties_set_updated_at
  before update on properties
  for each row execute function set_updated_at();

create index if not exists contacts_status_idx on contacts(status);
create index if not exists contacts_archived_created_at_idx on contacts(archived, created_at desc);
create index if not exists estimations_status_idx on estimations(status);
create index if not exists estimations_archived_created_at_idx on estimations(archived, created_at desc);
create index if not exists properties_status_idx on properties(status);
create index if not exists properties_type_city_idx on properties(type, city);
create index if not exists properties_featured_idx on properties(featured);
create index if not exists activities_created_at_idx on activities(created_at desc);

alter table contacts enable row level security;
alter table estimations enable row level security;
alter table properties enable row level security;
alter table activities enable row level security;

drop policy if exists "Public can submit contacts" on contacts;
create policy "Public can submit contacts"
  on contacts for insert to anon
  with check (status = 'NEW' and archived = false);

drop policy if exists "Public can submit estimations" on estimations;
create policy "Public can submit estimations"
  on estimations for insert to anon
  with check (status = 'NEW' and archived = false);

drop policy if exists "Public can read available properties" on properties;
create policy "Public can read available properties"
  on properties for select to anon
  using (status in ('available', 'under_offer'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'property-photos',
  'property-photos',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read property photos" on storage.objects;
create policy "Public can read property photos"
  on storage.objects for select to anon
  using (bucket_id = 'property-photos');

-- Les actions CRM d'ecriture, de mise a jour et de suppression passent par
-- les routes API serveur avec SUPABASE_SERVICE_ROLE_KEY.


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
create unique index if not exists leads_source_table_source_id_unique
  on leads(source_table, source_id)
  where source_table is not null and source_id is not null;
create index if not exists leads_source_table_source_id_idx on leads(source_table, source_id);
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


-- IMMO-DREAMS83 V3 phase 2
-- Supabase becomes the single source of truth for public properties.
-- Non destructive: existing columns and legacy photos JSON are kept.

create extension if not exists pgcrypto;

alter table properties add column if not exists commercial_status text;
alter table properties add column if not exists publication_status text not null default 'DRAFT';
alter table properties add column if not exists published_at timestamptz;
alter table properties add column if not exists unpublished_at timestamptz;
alter table properties add column if not exists archived_at timestamptz;
alter table properties add column if not exists archived_by uuid references profiles(id) on delete set null;
alter table properties add column if not exists created_by uuid references profiles(id) on delete set null;
alter table properties add column if not exists updated_by uuid references profiles(id) on delete set null;

update properties
set commercial_status = case
  when status = 'under_offer' then 'UNDER_OFFER'
  when status = 'sold' then 'SOLD'
  else 'AVAILABLE'
end
where commercial_status is null;

update properties
set publication_status = case
  when status = 'sold' then 'UNPUBLISHED'
  else 'PUBLISHED'
end
where publication_status is null
   or publication_status not in ('DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED');

update properties
set published_at = coalesce(published_at, created_at)
where publication_status = 'PUBLISHED'
  and published_at is null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'properties_commercial_status_check') then
    alter table properties
      add constraint properties_commercial_status_check
      check (commercial_status in ('AVAILABLE', 'UNDER_OFFER', 'SOLD'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'properties_publication_status_check') then
    alter table properties
      add constraint properties_publication_status_check
      check (publication_status in ('DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED'));
  end if;
end
$$;

create table if not exists property_photos (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  storage_bucket text not null default 'property-photos',
  storage_path text not null,
  public_url text not null,
  alt_text text,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  status text not null default 'ACTIVE',
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  trashed_at timestamptz,
  trashed_by uuid references profiles(id) on delete set null,
  restore_until timestamptz,
  restored_at timestamptz,
  purged_at timestamptz
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'property_photos_status_check') then
    alter table property_photos
      add constraint property_photos_status_check
      check (status in ('ACTIVE', 'TRASHED', 'PURGED'));
  end if;
end
$$;

create unique index if not exists property_photos_property_url_key
  on property_photos(property_id, public_url);
create unique index if not exists property_photos_primary_active_key
  on property_photos(property_id)
  where is_primary = true and status = 'ACTIVE';
create index if not exists property_photos_property_sort_idx
  on property_photos(property_id, status, sort_order);
create index if not exists property_photos_trash_idx
  on property_photos(status, trashed_at desc);

insert into property_photos (
  property_id,
  storage_bucket,
  storage_path,
  public_url,
  alt_text,
  sort_order,
  is_primary,
  status
)
select
  p.id,
  case
    when photo_url like '%/storage/v1/object/public/property-photos/%' then 'property-photos'
    else 'external'
  end,
  case
    when photo_url like '%/storage/v1/object/public/property-photos/%'
      then split_part(photo_url, '/storage/v1/object/public/property-photos/', 2)
    else 'external/' || md5(photo_url)
  end,
  photo_url,
  p.title || ' - photo ' || photo_ordinality,
  photo_ordinality - 1,
  photo_ordinality = 1,
  'ACTIVE'
from properties p
cross join lateral jsonb_array_elements_text(coalesce(p.photos, '[]'::jsonb))
  with ordinality as photo_items(photo_url, photo_ordinality)
on conflict (property_id, public_url) do update
set
  alt_text = excluded.alt_text,
  sort_order = excluded.sort_order,
  is_primary = excluded.is_primary,
  status = 'ACTIVE',
  restored_at = null,
  purged_at = null;

create table if not exists property_history (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties(id) on delete cascade,
  reference text not null,
  action text not null,
  changed_fields jsonb not null default '[]'::jsonb,
  previous_value jsonb,
  next_value jsonb,
  actor_id uuid references profiles(id) on delete set null,
  actor_email text,
  created_at timestamptz not null default now()
);

create index if not exists property_history_property_created_idx
  on property_history(property_id, created_at desc);
create index if not exists property_history_reference_idx
  on property_history(reference, created_at desc);

create table if not exists property_slug_history (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties(id) on delete cascade,
  old_slug text not null unique,
  new_slug text not null,
  reason text not null default 'legacy_redirect',
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

insert into property_slug_history (property_id, old_slug, new_slug, reason)
select id, 'appartement-t2-lumineux-toulon', slug, 'legacy_static_slug'
from properties
where slug = 'appartement-toulon-83000-ref-72'
on conflict (old_slug) do nothing;

drop view if exists public_property_slug_redirects;
drop view if exists public_properties;

create view public_properties as
select
  p.id,
  p.reference,
  p.mandate_number,
  p.slug,
  p.title,
  p.type,
  p.transaction_type,
  p.status,
  p.commercial_status,
  p.publication_status,
  p.city,
  p.postal_code,
  p.price,
  p.fees_included,
  p.surface,
  p.land_surface,
  p.rooms,
  p.bedrooms,
  p.bathrooms,
  p.energy_class,
  p.climate_class,
  p.description_short,
  p.description_long,
  p.features,
  coalesce(
    jsonb_agg(pp.public_url order by pp.sort_order)
      filter (where pp.id is not null and pp.status = 'ACTIVE'),
    p.photos,
    '[]'::jsonb
  ) as photos,
  p.featured,
  p.created_at,
  p.updated_at,
  p.published_at,
  p.archived_at
from properties p
left join property_photos pp
  on pp.property_id = p.id
 and pp.status = 'ACTIVE'
where p.publication_status = 'PUBLISHED'
  and p.archived_at is null
  and p.status in ('available', 'under_offer')
group by p.id;

create view public_property_slug_redirects as
select
  h.old_slug,
  h.new_slug
from property_slug_history h
join properties p on p.id = h.property_id
where p.publication_status = 'PUBLISHED'
  and p.archived_at is null
  and p.status in ('available', 'under_offer');

drop policy if exists "Public can read available properties" on properties;
revoke select on properties from anon;
grant select on public_properties to anon, authenticated;
grant select on public_property_slug_redirects to anon, authenticated;

alter table property_photos enable row level security;
alter table property_history enable row level security;
alter table property_slug_history enable row level security;

drop policy if exists "Active admins can read property photos" on property_photos;
create policy "Active admins can read property photos"
  on property_photos for select to authenticated
  using (public.is_active_admin());

drop policy if exists "Active admins can read property history" on property_history;
create policy "Active admins can read property history"
  on property_history for select to authenticated
  using (public.is_active_admin());

drop policy if exists "Active admins can read slug history" on property_slug_history;
create policy "Active admins can read slug history"
  on property_slug_history for select to authenticated
  using (public.is_active_admin());

create index if not exists properties_public_visibility_idx
  on properties(publication_status, archived_at, status, featured, updated_at desc);
create index if not exists properties_commercial_status_idx
  on properties(commercial_status);
