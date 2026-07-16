-- IMMO-DREAMS83 V3 phase 3
-- Commercial CRM foundation: normalized contacts, lead sources, dedupe and merge audit.
-- Non destructive: legacy contacts and estimations remain readable during transition.

create extension if not exists pgcrypto;

create table if not exists lead_sources (
  code text primary key,
  label text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into lead_sources (code, label, description)
values
  ('CONTACT_FORM', 'Formulaire contact', 'Demande envoyee depuis la page Contact.'),
  ('ESTIMATION_FORM', 'Formulaire estimation', 'Demande envoyee depuis la page Estimation.'),
  ('PHONE', 'Telephone', 'Demande creee manuellement apres un appel.'),
  ('AGENCY', 'Agence', 'Demande creee en agence.'),
  ('EMAIL', 'Email direct', 'Demande recue par email direct.'),
  ('LEGACY_IMPORT', 'Import legacy', 'Donnees transformees depuis les anciennes tables contacts et estimations.')
on conflict (code) do update
set
  label = excluded.label,
  description = excluded.description,
  is_active = true;

alter table contacts add column if not exists normalized_email text;
alter table contacts add column if not exists normalized_phone text;
alter table contacts add column if not exists canonical_contact_id uuid references contacts(id) on delete set null;
alter table contacts add column if not exists contact_source text not null default 'LEGACY_IMPORT';
alter table contacts add column if not exists last_contacted_at timestamptz;
alter table contacts add column if not exists dedupe_status text not null default 'UNREVIEWED';

update contacts
set normalized_email = lower(trim(email))
where email is not null
  and (normalized_email is null or normalized_email = '');

update contacts
set normalized_phone = regexp_replace(phone, '\D', '', 'g')
where phone is not null
  and (normalized_phone is null or normalized_phone = '');

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'contacts_dedupe_status_check') then
    alter table contacts
      add constraint contacts_dedupe_status_check
      check (dedupe_status in ('UNREVIEWED', 'MATCH_CERTAIN', 'MATCH_PROBABLE', 'AMBIGUOUS', 'MERGED', 'IGNORED'));
  end if;
end
$$;

alter table leads add column if not exists title text;
alter table leads add column if not exists request_type text;
alter table leads add column if not exists project_type text;
alter table leads add column if not exists property_type text;
alter table leads add column if not exists city text;
alter table leads add column if not exists postal_code text;
alter table leads add column if not exists budget_min numeric;
alter table leads add column if not exists budget_max numeric;
alter table leads add column if not exists desired_surface numeric;
alter table leads add column if not exists desired_rooms numeric;
alter table leads add column if not exists source_code text references lead_sources(code) on delete set null;
alter table leads add column if not exists source_payload jsonb not null default '{}'::jsonb;
alter table leads add column if not exists dedupe_status text not null default 'UNREVIEWED';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leads_dedupe_status_check') then
    alter table leads
      add constraint leads_dedupe_status_check
      check (dedupe_status in ('UNREVIEWED', 'MATCH_CERTAIN', 'MATCH_PROBABLE', 'AMBIGUOUS', 'READY', 'MIGRATED', 'IGNORED'));
  end if;
end
$$;

create table if not exists lead_merge_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  primary_contact_id uuid references contacts(id) on delete set null,
  merged_contact_id uuid references contacts(id) on delete set null,
  lead_id uuid references leads(id) on delete set null,
  match_category text not null,
  matched_keys jsonb not null default '[]'::jsonb,
  previous_payload jsonb,
  next_payload jsonb,
  actor_id uuid references profiles(id) on delete set null,
  actor_email text,
  note text
);

create table if not exists lead_import_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  mode text not null default 'dry-run',
  source text not null default 'legacy_contacts_estimations',
  contacts_read integer not null default 0,
  estimations_read integer not null default 0,
  match_certain integer not null default 0,
  match_probable integer not null default 0,
  ambiguous integer not null default 0,
  no_match integer not null default 0,
  writes_performed boolean not null default false,
  report jsonb not null default '{}'::jsonb,
  created_by uuid references profiles(id) on delete set null
);

create or replace view crm_legacy_lead_candidates as
select
  'contacts'::text as legacy_table,
  c.id::text as legacy_id,
  c.created_at,
  c.name,
  c.email,
  c.phone,
  c.normalized_email,
  c.normalized_phone,
  c.city,
  c.request_type,
  c.status,
  c.archived,
  jsonb_build_object(
    'message', c.message,
    'notes', c.notes
  ) as payload
from contacts c
union all
select
  'estimations'::text as legacy_table,
  e.id::text as legacy_id,
  e.created_at,
  e.name,
  e.email,
  e.phone,
  lower(trim(e.email)) as normalized_email,
  regexp_replace(e.phone, '\D', '', 'g') as normalized_phone,
  e.city,
  'Estimation ' || e.property_type as request_type,
  e.status,
  e.archived,
  jsonb_build_object(
    'message', e.message,
    'property_type', e.property_type,
    'postal_code', e.postal_code,
    'surface', e.surface,
    'rooms', e.rooms
  ) as payload
from estimations e;

create index if not exists contacts_normalized_email_idx on contacts(normalized_email);
create index if not exists contacts_normalized_phone_idx on contacts(normalized_phone);
create index if not exists contacts_canonical_contact_idx on contacts(canonical_contact_id);
create index if not exists contacts_dedupe_status_idx on contacts(dedupe_status);
create index if not exists leads_source_code_idx on leads(source_code);
create index if not exists leads_dedupe_status_idx on leads(dedupe_status);
create index if not exists leads_project_type_idx on leads(project_type);
create index if not exists lead_merge_logs_primary_contact_idx on lead_merge_logs(primary_contact_id, created_at desc);
create index if not exists lead_import_runs_created_at_idx on lead_import_runs(created_at desc);

alter table lead_sources enable row level security;
alter table lead_merge_logs enable row level security;
alter table lead_import_runs enable row level security;

drop policy if exists "Active admins can read lead sources" on lead_sources;
create policy "Active admins can read lead sources"
  on lead_sources for select to authenticated
  using (public.is_active_admin());

drop policy if exists "Active admins can read merge logs" on lead_merge_logs;
create policy "Active admins can read merge logs"
  on lead_merge_logs for select to authenticated
  using (public.is_active_admin());

drop policy if exists "Active admins can read lead import runs" on lead_import_runs;
create policy "Active admins can read lead import runs"
  on lead_import_runs for select to authenticated
  using (public.is_active_admin());

grant select on crm_legacy_lead_candidates to authenticated;
