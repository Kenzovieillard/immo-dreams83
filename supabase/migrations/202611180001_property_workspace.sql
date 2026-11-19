begin;

alter table public.properties
  add column if not exists street_address text,
  add column if not exists latitude double precision check (latitude between -90 and 90),
  add column if not exists longitude double precision check (longitude between -180 and 180),
  add column if not exists owner_contact_id uuid references public.contacts(id) on delete set null,
  add column if not exists advisor_id uuid references public.profiles(id) on delete set null,
  add column if not exists workspace_details jsonb not null default '{}'::jsonb;

create index if not exists properties_advisor_idx on public.properties(advisor_id);
create index if not exists properties_owner_contact_idx on public.properties(owner_contact_id);

create table if not exists public.property_drafts (
  id uuid primary key,
  author_id uuid not null references public.profiles(id) on delete cascade,
  step smallint not null check (step between 0 and 7),
  form jsonb not null check (jsonb_typeof(form) = 'object'),
  updated_at timestamptz not null default now()
);

create index if not exists property_drafts_author_updated_idx
  on public.property_drafts(author_id, updated_at desc);

create table if not exists public.property_documents (
  id uuid primary key,
  property_id uuid not null references public.properties(id) on delete restrict,
  file_name text not null,
  storage_path text not null unique,
  kind text not null check (kind in ('mandate', 'diagnostic', 'plan', 'ownership', 'other')),
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  archived_at timestamptz
);

create index if not exists property_documents_property_date_idx
  on public.property_documents(property_id, created_at desc);

create table if not exists public.property_document_folders (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);
create unique index if not exists property_document_folders_by_name
  on public.property_document_folders(property_id, lower(name));
alter table public.property_documents
  add column if not exists folder_id uuid references public.property_document_folders(id) on delete set null,
  add column if not exists size_bytes integer check (size_bytes between 1 and 4194304);

alter table public.property_drafts enable row level security;
alter table public.property_documents enable row level security;
alter table public.property_document_folders enable row level security;
revoke all on public.property_drafts, public.property_documents, public.property_document_folders from public, anon, authenticated;
grant select, insert, update, delete on public.property_drafts to service_role;
grant select, insert, update on public.property_documents to service_role;
grant select, insert on public.property_document_folders to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'crm-property-documents', 'crm-property-documents', false, 4194304,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- The existing public_properties view has an explicit public projection.
-- Internal address, coordinates, ownership and documents stay outside that projection.

commit;
