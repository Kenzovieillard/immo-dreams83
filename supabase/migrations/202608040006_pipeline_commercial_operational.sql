-- IMMO-DREAMS83 V3
-- Canonical commercial dossiers, actionable reminders, visits and purchase offers.
-- Additive only: existing identifiers and legacy compatibility columns remain available.

alter table leads add column if not exists dossier_reference text;

update leads
set dossier_reference = 'DOS-' || upper(substr(replace(id::text, '-', ''), 1, 8))
where dossier_reference is null;

create or replace function public.set_lead_dossier_reference()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.dossier_reference is null or btrim(new.dossier_reference) = '' then
    new.dossier_reference := 'DOS-' || upper(substr(replace(new.id::text, '-', ''), 1, 8));
  end if;
  return new;
end;
$$;

drop trigger if exists leads_set_dossier_reference on leads;
create trigger leads_set_dossier_reference
  before insert or update of dossier_reference on leads
  for each row execute function public.set_lead_dossier_reference();

create unique index if not exists leads_dossier_reference_idx
  on leads(dossier_reference)
  where dossier_reference is not null;

alter table tasks add column if not exists contact_id uuid references contacts(id) on delete set null;
alter table tasks add column if not exists property_id uuid references properties(id) on delete set null;
alter table tasks add column if not exists offer_id uuid references offers(id) on delete set null;
alter table tasks add column if not exists appointment_id uuid references appointments(id) on delete set null;
alter table tasks add column if not exists status text not null default 'TODO';

update tasks
set status = case when completed_at is null then 'TODO' else 'COMPLETED' end
where status is null or status not in ('TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

alter table tasks drop constraint if exists tasks_status_check;
alter table tasks
  add constraint tasks_status_check
  check (status in ('TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')) not valid;

create index if not exists tasks_status_due_at_idx on tasks(status, due_at);
create index if not exists tasks_contact_id_idx on tasks(contact_id);
create index if not exists tasks_property_id_idx on tasks(property_id);
create index if not exists tasks_offer_id_idx on tasks(offer_id);

alter table appointments add column if not exists appointment_type text not null default 'MEETING';
alter table appointments add column if not exists comment text;
alter table appointments add column if not exists buyer_feedback text;
alter table appointments add column if not exists seller_feedback text;
alter table appointments add column if not exists outcome text;
alter table appointments add column if not exists next_action text;

alter table appointments drop constraint if exists appointments_type_check;
alter table appointments
  add constraint appointments_type_check
  check (appointment_type in ('MEETING', 'VISIT', 'ESTIMATION', 'CALL')) not valid;

create index if not exists appointments_type_starts_at_idx
  on appointments(appointment_type, starts_at);

alter table offers add column if not exists buyer_dossier_id uuid references leads(id) on delete restrict;
alter table offers add column if not exists buyer_contact_id uuid references contacts(id) on delete restrict;
alter table offers add column if not exists responsible_user_id uuid references profiles(id) on delete restrict;
alter table offers add column if not exists offer_date date;
alter table offers add column if not exists valid_until date;
alter table offers add column if not exists next_action text;
alter table offers add column if not exists next_action_due_at timestamptz;
alter table offers add column if not exists financing_type text not null default 'UNKNOWN';
alter table offers add column if not exists down_payment_amount numeric;
alter table offers add column if not exists loan_amount numeric;
alter table offers add column if not exists suspensive_conditions text;
alter table offers add column if not exists included_furniture text;
alter table offers add column if not exists negotiation_comment text;
alter table offers add column if not exists signed_document_id text;
alter table offers add column if not exists submitted_to_seller_at timestamptz;
alter table offers add column if not exists accepted_at timestamptz;
alter table offers add column if not exists rejected_at timestamptz;
alter table offers add column if not exists withdrawn_at timestamptz;
alter table offers add column if not exists rejection_reason text;
alter table offers add column if not exists withdrawal_reason text;
alter table offers add column if not exists created_from_visit_id uuid references appointments(id) on delete set null;
alter table offers add column if not exists is_test boolean not null default false;

update offers
set
  buyer_dossier_id = coalesce(buyer_dossier_id, lead_id),
  buyer_contact_id = coalesce(buyer_contact_id, contact_id),
  responsible_user_id = coalesce(responsible_user_id, assigned_to),
  offer_date = coalesce(offer_date, offered_at::date, created_at::date),
  valid_until = coalesce(valid_until, expires_at::date, (created_at + interval '7 days')::date),
  next_action = coalesce(nullif(btrim(next_action), ''), 'Valider et transmettre l''offre'),
  next_action_due_at = coalesce(next_action_due_at, expires_at, created_at + interval '1 day'),
  is_test = is_test or coalesce(notes, '') ilike '%[RECETTE:%';

alter table offers drop constraint if exists offers_status_check;
update offers set status = 'SENT_TO_SELLER' where status = 'SUBMITTED';
update offers set status = 'REJECTED' where status = 'REFUSED';

alter table offers
  add constraint offers_status_check
  check (status in (
    'DRAFT',
    'TO_BE_SIGNED',
    'SIGNED_BY_BUYER',
    'SENT_TO_SELLER',
    'NEGOTIATING',
    'ACCEPTED',
    'REJECTED',
    'WITHDRAWN',
    'EXPIRED'
  )) not valid;

alter table offers drop constraint if exists offers_amount_check;
alter table offers
  add constraint offers_amount_check
  check (amount is null or amount > 0) not valid;

alter table offers drop constraint if exists offers_financing_type_check;
alter table offers
  add constraint offers_financing_type_check
  check (financing_type in ('CASH', 'LOAN', 'MIXED', 'UNKNOWN')) not valid;

alter table offers drop constraint if exists offers_validity_check;
alter table offers
  add constraint offers_validity_check
  check (offer_date is null or valid_until is null or valid_until >= offer_date) not valid;

alter table offers drop constraint if exists offers_required_relationships_check;
alter table offers
  add constraint offers_required_relationships_check
  check (
    property_id is not null and
    buyer_dossier_id is not null and
    buyer_contact_id is not null and
    responsible_user_id is not null
  ) not valid;

create index if not exists offers_buyer_dossier_id_idx on offers(buyer_dossier_id);
create index if not exists offers_buyer_contact_id_idx on offers(buyer_contact_id);
create index if not exists offers_responsible_user_id_idx on offers(responsible_user_id);
create index if not exists offers_active_status_idx on offers(status, is_test);

create table if not exists offer_status_history (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references offers(id) on delete cascade,
  previous_status text,
  next_status text not null,
  reason text,
  changed_by uuid references profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists offer_status_history_offer_created_idx
  on offer_status_history(offer_id, created_at desc);

alter table offer_status_history enable row level security;
drop policy if exists "Active admins can read offer status history" on offer_status_history;
create policy "Active admins can read offer status history"
  on offer_status_history for select to authenticated
  using (public.is_active_admin());

create table if not exists offer_documents (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references offers(id) on delete cascade,
  document_type text not null default 'SIGNED_OFFER',
  storage_bucket text not null,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  uploaded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists offer_documents_offer_id_idx on offer_documents(offer_id);

alter table offer_documents enable row level security;
drop policy if exists "Active admins can read offer documents" on offer_documents;
create policy "Active admins can read offer documents"
  on offer_documents for select to authenticated
  using (public.is_active_admin());
