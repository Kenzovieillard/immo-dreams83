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
