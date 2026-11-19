-- CRM Commercial IMMO DREAMS 83 - fonctions restantes et historique metier.
-- Migration additive et compatible avec les modules Pipeline, Estimations,
-- Visites, Offres et Negociations deja en production.

set lock_timeout = '5s';
set statement_timeout = '120s';

alter table public.activities
  add column if not exists actor_id uuid references public.profiles(id) on delete set null,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.offer_documents
  add column if not exists file_size bigint,
  add column if not exists document_status text not null default 'READY',
  add column if not exists confidentiality text not null default 'PRIVATE',
  add column if not exists version integer not null default 1;

alter table public.offer_documents drop constraint if exists offer_documents_file_size_check;
alter table public.offer_documents add constraint offer_documents_file_size_check
  check (file_size is null or (file_size > 0 and file_size <= 10485760)) not valid;
alter table public.offer_documents drop constraint if exists offer_documents_status_check;
alter table public.offer_documents add constraint offer_documents_status_check
  check (document_status in ('DRAFT', 'READY', 'SENT', 'SIGNED', 'ARCHIVED')) not valid;
alter table public.offer_documents drop constraint if exists offer_documents_confidentiality_check;
alter table public.offer_documents add constraint offer_documents_confidentiality_check
  check (confidentiality in ('PRIVATE', 'AGENCY', 'PARTIES')) not valid;
alter table public.offer_documents drop constraint if exists offer_documents_version_check;
alter table public.offer_documents add constraint offer_documents_version_check
  check (version > 0) not valid;

alter table public.appointments drop constraint if exists appointments_report_next_action_check;
alter table public.appointments add constraint appointments_report_next_action_check
  check (
    report_next_action is null or report_next_action in (
      'CREATE_OFFER', 'PLAN_SECOND_VISIT', 'FOLLOW_UP_LATER', 'NO_FOLLOW_UP'
    )
  ) not valid;

create index if not exists activities_entity_created_idx
  on public.activities(entity_type, entity_id, created_at desc);
create index if not exists activities_actor_created_idx
  on public.activities(actor_id, created_at desc) where actor_id is not null;
create index if not exists estimations_contact_created_idx
  on public.estimations(contact_id, created_at desc) where contact_id is not null;
create index if not exists estimations_assigned_status_idx
  on public.estimations(assigned_to, commercial_status, appointment_at);
create index if not exists appointments_visit_relations_idx
  on public.appointments(appointment_type, property_id, contact_id, starts_at);
create index if not exists appointments_assigned_visit_status_idx
  on public.appointments(assigned_to, visit_status, starts_at);
create index if not exists offers_visit_idx
  on public.offers(created_from_visit_id) where created_from_visit_id is not null;

create or replace function public.move_commercial_pipeline(
  p_lead_id uuid,
  p_stage text,
  p_actor_id uuid,
  p_actor_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_lead public.leads%rowtype;
  expected_type text;
begin
  if p_stage not in (
    'BUYER_NEW', 'BUYER_QUALIFIED', 'BUYER_VISIT', 'BUYER_OFFER', 'BUYER_COMPROMISE', 'BUYER_FINALIZED',
    'SELLER_NEW', 'SELLER_CONTACT', 'SELLER_ESTIMATE_SCHEDULED', 'SELLER_ESTIMATE_DONE',
    'SELLER_MANDATE_PROPOSED', 'SELLER_MANDATE_SIGNED', 'SELLER_MARKETED'
  ) then
    raise exception 'COMMERCIAL_STAGE_INVALID';
  end if;

  select * into current_lead
  from public.leads
  where id = p_lead_id and archived = false
  for update;
  if not found then
    raise exception 'COMMERCIAL_CASE_NOT_FOUND';
  end if;

  expected_type := case when p_stage like 'SELLER\_%' escape '\' then 'SELLER' else 'BUYER' end;
  if current_lead.pipeline_type <> expected_type then
    raise exception 'COMMERCIAL_STAGE_TYPE_MISMATCH';
  end if;

  if current_lead.pipeline_stage is distinct from p_stage then
    update public.leads
      set pipeline_stage = p_stage,
          stage_entered_at = now(),
          updated_at = now()
    where id = p_lead_id;

    insert into public.activities(entity_type, entity_id, action, user_name, actor_id, metadata)
    values (
      'lead', p_lead_id, 'Etape pipeline modifiee',
      coalesce(nullif(btrim(p_actor_name), ''), 'Utilisateur CRM'), p_actor_id,
      jsonb_build_object('previous_stage', current_lead.pipeline_stage, 'next_stage', p_stage)
    );
  end if;
  return p_lead_id;
end;
$$;

create or replace function public.create_commercial_case(
  p_contact_id uuid,
  p_pipeline_type text,
  p_assigned_to uuid,
  p_property_id uuid,
  p_estimation_id uuid,
  p_priority text,
  p_title text,
  p_notes text,
  p_actor_id uuid,
  p_actor_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  created_id uuid := gen_random_uuid();
  initial_stage text;
begin
  if p_pipeline_type not in ('BUYER', 'SELLER') then raise exception 'COMMERCIAL_TYPE_INVALID'; end if;
  if p_priority not in ('low', 'normal', 'high', 'urgent') then raise exception 'COMMERCIAL_PRIORITY_INVALID'; end if;
  if nullif(btrim(p_title), '') is null then raise exception 'COMMERCIAL_TITLE_REQUIRED'; end if;
  if not exists (select 1 from public.contacts where id = p_contact_id and archived = false) then
    raise exception 'COMMERCIAL_CONTACT_NOT_FOUND';
  end if;
  if p_assigned_to is not null and not exists (
    select 1 from public.profiles where id = p_assigned_to and is_active = true
  ) then raise exception 'COMMERCIAL_ASSIGNEE_INVALID'; end if;
  if p_property_id is not null and not exists (
    select 1 from public.properties where id = p_property_id and archived_at is null
  ) then raise exception 'COMMERCIAL_PROPERTY_NOT_FOUND'; end if;
  if p_estimation_id is not null and not exists (
    select 1 from public.estimations where id = p_estimation_id and archived = false
  ) then raise exception 'COMMERCIAL_ESTIMATION_NOT_FOUND'; end if;

  initial_stage := case when p_pipeline_type = 'SELLER' then 'SELLER_NEW' else 'BUYER_NEW' end;
  insert into public.leads(
    id, contact_id, pipeline_type, pipeline_stage, stage_entered_at, lead_type,
    source, source_table, source_id, title, notes, assigned_to,
    linked_property_id, estimation_id, priority, status
  ) values (
    created_id, p_contact_id, p_pipeline_type, initial_stage, now(), lower(p_pipeline_type),
    'commercial_manual', 'contacts', p_contact_id::text, btrim(p_title), nullif(btrim(p_notes), ''),
    p_assigned_to, p_property_id, p_estimation_id, p_priority, 'NEW'
  );

  update public.contacts
    set pipeline_lead_id = coalesce(pipeline_lead_id, created_id), updated_at = now()
  where id = p_contact_id;

  insert into public.activities(entity_type, entity_id, action, user_name, actor_id, metadata)
  values (
    'lead', created_id, 'Dossier commercial cree',
    coalesce(nullif(btrim(p_actor_name), ''), 'Utilisateur CRM'), p_actor_id,
    jsonb_build_object('contact_id', p_contact_id, 'pipeline_type', p_pipeline_type,
      'property_id', p_property_id, 'estimation_id', p_estimation_id)
  );
  return created_id;
end;
$$;

create or replace function public.transform_commercial_estimation(
  p_estimation_id uuid,
  p_listing_price numeric,
  p_mandate_type text,
  p_actor_id uuid,
  p_actor_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  estimation_row public.estimations%rowtype;
  property_id uuid := gen_random_uuid();
  case_id uuid := gen_random_uuid();
  mandate_id uuid := gen_random_uuid();
  short_id text;
  property_reference text;
  property_slug text;
  mandate_reference text;
  normalized_type text;
begin
  if p_listing_price is null or p_listing_price <= 0 then raise exception 'COMMERCIAL_PRICE_INVALID'; end if;
  if p_mandate_type not in ('simple', 'exclusive', 'semi-exclusive') then
    raise exception 'COMMERCIAL_MANDATE_TYPE_INVALID';
  end if;

  select * into estimation_row from public.estimations
  where id = p_estimation_id and archived = false for update;
  if not found then raise exception 'COMMERCIAL_ESTIMATION_NOT_FOUND'; end if;
  if estimation_row.converted_to_property or estimation_row.converted_property_id is not null then
    raise exception 'COMMERCIAL_ESTIMATION_ALREADY_TRANSFORMED';
  end if;
  if estimation_row.contact_id is null or not exists (
    select 1 from public.contacts where id = estimation_row.contact_id and archived = false
  ) then raise exception 'COMMERCIAL_ESTIMATION_CONTACT_REQUIRED'; end if;

  short_id := upper(substr(replace(property_id::text, '-', ''), 1, 10));
  property_reference := 'CRM-' || short_id;
  property_slug := lower('crm-' || short_id || '-' || regexp_replace(estimation_row.city, '[^a-zA-Z0-9]+', '-', 'g'));
  mandate_reference := 'MAND-' || upper(substr(replace(mandate_id::text, '-', ''), 1, 10));
  normalized_type := case
    when lower(estimation_row.property_type) like any(array['%appart%', '%studio%']) then 'apartment'
    when lower(estimation_row.property_type) like any(array['%maison%', '%villa%']) then 'house'
    when lower(estimation_row.property_type) like '%terrain%' then 'land'
    when lower(estimation_row.property_type) like any(array['%commerce%', '%local%']) then 'commercial'
    else 'other'
  end;

  insert into public.properties(
    id, reference, slug, title, type, transaction_type, status, commercial_status,
    publication_status, city, postal_code, price, surface, rooms,
    description_short, description_long, photos, features, mandate_number, created_by
  ) values (
    property_id, property_reference, property_slug,
    estimation_row.property_type || ' - ' || estimation_row.city,
    normalized_type, 'sale', 'available', 'AVAILABLE', 'DRAFT', estimation_row.city,
    coalesce(nullif(estimation_row.postal_code, ''), '83000'), p_listing_price,
    estimation_row.surface, estimation_row.rooms,
    'Bien cree depuis une estimation CRM.', coalesce(estimation_row.notes, ''),
    '[]'::jsonb, '[]'::jsonb, mandate_reference, p_actor_id
  );

  insert into public.leads(
    id, contact_id, estimation_id, linked_property_id, lead_type, pipeline_type,
    pipeline_stage, stage_entered_at, source, source_table, source_id,
    title, assigned_to, status, estimated_budget, priority
  ) values (
    case_id, estimation_row.contact_id, estimation_row.id, property_id, 'seller', 'SELLER',
    'SELLER_MANDATE_SIGNED', now(), 'commercial_estimation_conversion', 'estimations', estimation_row.id::text,
    'Mandat - ' || estimation_row.property_type || ' - ' || estimation_row.city,
    coalesce(estimation_row.assigned_to, p_actor_id), 'MANDATE_SIGNED', p_listing_price, 'high'
  );

  insert into public.mandates(
    id, mandate_number, mandate_type, status, lead_id, property_id, signed_at
  ) values (mandate_id, mandate_reference, p_mandate_type, 'signed', case_id, property_id, now());

  update public.estimations set
    converted_property_id = property_id,
    converted_to_property = true,
    selected_mandate_type = p_mandate_type,
    listing_price = p_listing_price,
    commercial_status = 'FINISHED',
    updated_at = now()
  where id = estimation_row.id;

  update public.contacts set pipeline_lead_id = coalesce(pipeline_lead_id, case_id), updated_at = now()
  where id = estimation_row.contact_id;

  insert into public.activities(entity_type, entity_id, action, user_name, actor_id, metadata) values
    ('estimation', estimation_row.id, 'Estimation transformee en bien', coalesce(nullif(btrim(p_actor_name), ''), 'Utilisateur CRM'), p_actor_id,
      jsonb_build_object('property_id', property_id, 'commercial_case_id', case_id, 'mandate_id', mandate_id)),
    ('property', property_id, 'Bien cree depuis une estimation', coalesce(nullif(btrim(p_actor_name), ''), 'Utilisateur CRM'), p_actor_id,
      jsonb_build_object('estimation_id', estimation_row.id, 'listing_price', p_listing_price)),
    ('lead', case_id, 'Dossier vendeur et mandat crees', coalesce(nullif(btrim(p_actor_name), ''), 'Utilisateur CRM'), p_actor_id,
      jsonb_build_object('property_id', property_id, 'mandate_id', mandate_id)),
    ('mandate', mandate_id, 'Mandat signe lie au dossier vendeur', coalesce(nullif(btrim(p_actor_name), ''), 'Utilisateur CRM'), p_actor_id,
      jsonb_build_object('property_id', property_id, 'lead_id', case_id));

  return jsonb_build_object(
    'property_id', property_id,
    'commercial_case_id', case_id,
    'mandate_id', mandate_id,
    'property_slug', property_slug
  );
end;
$$;

create or replace function public.create_commercial_visit(
  p_property_id uuid,
  p_contact_id uuid,
  p_lead_id uuid,
  p_assigned_to uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_location text,
  p_notes text,
  p_actor_id uuid,
  p_actor_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  created_id uuid := gen_random_uuid();
  property_row public.properties%rowtype;
  contact_name text;
begin
  if p_starts_at is null then raise exception 'COMMERCIAL_VISIT_DATE_REQUIRED'; end if;
  if p_ends_at is not null and p_ends_at <= p_starts_at then raise exception 'COMMERCIAL_VISIT_DATES_INVALID'; end if;
  select * into property_row from public.properties where id = p_property_id and archived_at is null;
  if not found then raise exception 'COMMERCIAL_PROPERTY_NOT_FOUND'; end if;
  select name into contact_name from public.contacts where id = p_contact_id and archived = false;
  if contact_name is null then raise exception 'COMMERCIAL_CONTACT_NOT_FOUND'; end if;
  if not exists (select 1 from public.profiles where id = p_assigned_to and is_active = true) then
    raise exception 'COMMERCIAL_ASSIGNEE_INVALID';
  end if;
  if p_lead_id is not null and not exists (
    select 1 from public.leads where id = p_lead_id and contact_id = p_contact_id and archived = false
  ) then raise exception 'COMMERCIAL_CASE_RELATION_INVALID'; end if;

  insert into public.appointments(
    id, appointment_type, property_id, contact_id, lead_id, assigned_to, title,
    starts_at, ends_at, location, comment, visit_status
  ) values (
    created_id, 'VISIT', p_property_id, p_contact_id, p_lead_id, p_assigned_to,
    'Visite ' || property_row.reference || ' - ' || contact_name,
    p_starts_at, coalesce(p_ends_at, p_starts_at + interval '1 hour'),
    nullif(btrim(p_location), ''), nullif(btrim(p_notes), ''), 'TO_CONFIRM'
  );

  insert into public.activities(entity_type, entity_id, action, user_name, actor_id, metadata)
  values ('appointment', created_id, 'Visite planifiee', coalesce(nullif(btrim(p_actor_name), ''), 'Utilisateur CRM'), p_actor_id,
    jsonb_build_object('property_id', p_property_id, 'contact_id', p_contact_id, 'lead_id', p_lead_id, 'starts_at', p_starts_at));
  return created_id;
end;
$$;

create or replace function public.update_commercial_visit(
  p_visit_id uuid,
  p_action text,
  p_visit_status text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_actor_id uuid,
  p_actor_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  visit_row public.appointments%rowtype;
begin
  select * into visit_row from public.appointments
  where id = p_visit_id and appointment_type = 'VISIT' for update;
  if not found then raise exception 'COMMERCIAL_VISIT_NOT_FOUND'; end if;

  if p_action = 'SET_STATUS' then
    if p_visit_status not in ('TO_CONFIRM', 'CONFIRMED', 'COMPLETED', 'CANCELLED') then
      raise exception 'COMMERCIAL_VISIT_STATUS_INVALID';
    end if;
    update public.appointments set visit_status = p_visit_status, updated_at = now() where id = p_visit_id;
    insert into public.activities(entity_type, entity_id, action, user_name, actor_id, metadata)
    values ('appointment', p_visit_id, 'Statut de visite modifie', coalesce(nullif(btrim(p_actor_name), ''), 'Utilisateur CRM'), p_actor_id,
      jsonb_build_object('previous_status', visit_row.visit_status, 'next_status', p_visit_status));
  elsif p_action = 'RESCHEDULE' then
    if p_starts_at is null or (p_ends_at is not null and p_ends_at <= p_starts_at) then
      raise exception 'COMMERCIAL_VISIT_DATES_INVALID';
    end if;
    update public.appointments set starts_at = p_starts_at,
      ends_at = coalesce(p_ends_at, p_starts_at + interval '1 hour'), updated_at = now()
    where id = p_visit_id;
    insert into public.activities(entity_type, entity_id, action, user_name, actor_id, metadata)
    values ('appointment', p_visit_id, 'Visite replanifiee', coalesce(nullif(btrim(p_actor_name), ''), 'Utilisateur CRM'), p_actor_id,
      jsonb_build_object('previous_starts_at', visit_row.starts_at, 'next_starts_at', p_starts_at));
  else
    raise exception 'COMMERCIAL_VISIT_ACTION_INVALID';
  end if;
  return p_visit_id;
end;
$$;

create or replace function public.submit_commercial_visit_report(
  p_visit_id uuid,
  p_general_impression text,
  p_positive_points text[],
  p_blocking_points text[],
  p_interest_level integer,
  p_comments text,
  p_next_action text,
  p_follow_up_at timestamptz,
  p_actor_id uuid,
  p_actor_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  visit_row public.appointments%rowtype;
  task_id uuid;
begin
  if p_general_impression not in ('POSITIVE', 'MIXED', 'NEGATIVE') then raise exception 'COMMERCIAL_VISIT_IMPRESSION_INVALID'; end if;
  if p_interest_level < 1 or p_interest_level > 5 then raise exception 'COMMERCIAL_VISIT_INTEREST_INVALID'; end if;
  if p_next_action not in ('CREATE_OFFER', 'PLAN_SECOND_VISIT', 'FOLLOW_UP_LATER', 'NO_FOLLOW_UP') then
    raise exception 'COMMERCIAL_VISIT_NEXT_ACTION_INVALID';
  end if;
  if p_next_action = 'FOLLOW_UP_LATER' and p_follow_up_at is null then
    raise exception 'COMMERCIAL_VISIT_FOLLOW_UP_REQUIRED';
  end if;

  select * into visit_row from public.appointments
  where id = p_visit_id and appointment_type = 'VISIT' for update;
  if not found then raise exception 'COMMERCIAL_VISIT_NOT_FOUND'; end if;

  update public.appointments set
    visit_status = 'COMPLETED', general_impression = p_general_impression,
    positive_points = coalesce(p_positive_points, array[]::text[]),
    blocking_points = coalesce(p_blocking_points, array[]::text[]),
    interest_level = p_interest_level, additional_comments = nullif(btrim(p_comments), ''),
    report_next_action = p_next_action, report_submitted_at = now(),
    outcome = p_general_impression, next_action = p_next_action, updated_at = now()
  where id = p_visit_id;

  if p_next_action = 'FOLLOW_UP_LATER' then
    task_id := gen_random_uuid();
    insert into public.tasks(
      id, appointment_id, lead_id, contact_id, property_id, assigned_to, created_by,
      title, description, due_at, priority, status, task_type
    ) values (
      task_id, p_visit_id, visit_row.lead_id, visit_row.contact_id, visit_row.property_id,
      visit_row.assigned_to, p_actor_id, 'Relancer apres la visite',
      'Relance creee depuis le compte rendu de visite.', p_follow_up_at, 'high', 'TODO', 'FOLLOW_UP'
    );
  end if;

  insert into public.activities(entity_type, entity_id, action, user_name, actor_id, metadata)
  values ('appointment', p_visit_id, 'Compte rendu de visite enregistre', coalesce(nullif(btrim(p_actor_name), ''), 'Utilisateur CRM'), p_actor_id,
    jsonb_build_object('next_action', p_next_action, 'interest_level', p_interest_level, 'task_id', task_id));
  return jsonb_build_object(
    'visit_id', p_visit_id, 'property_id', visit_row.property_id,
    'contact_id', visit_row.contact_id, 'lead_id', visit_row.lead_id,
    'next_action', p_next_action, 'task_id', task_id
  );
end;
$$;

create or replace function public.create_commercial_offer(
  p_property_id uuid,
  p_buyer_dossier_id uuid,
  p_buyer_contact_id uuid,
  p_visit_id uuid,
  p_responsible_user_id uuid,
  p_amount numeric,
  p_offer_date date,
  p_valid_until date,
  p_financing_type text,
  p_down_payment_amount numeric,
  p_loan_amount numeric,
  p_suspensive_conditions text,
  p_included_furniture text,
  p_negotiation_comment text,
  p_submission text,
  p_actor_id uuid,
  p_actor_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  created_id uuid := gen_random_uuid();
  created_status text;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'COMMERCIAL_OFFER_AMOUNT_INVALID'; end if;
  if p_offer_date is null or p_valid_until is null or p_valid_until < p_offer_date then raise exception 'COMMERCIAL_OFFER_DATES_INVALID'; end if;
  if p_financing_type not in ('CASH', 'LOAN', 'MIXED', 'UNKNOWN') then raise exception 'COMMERCIAL_FINANCING_INVALID'; end if;
  if p_submission not in ('draft', 'create') then raise exception 'COMMERCIAL_SUBMISSION_INVALID'; end if;
  if not exists (select 1 from public.properties where id = p_property_id and archived_at is null) then raise exception 'COMMERCIAL_PROPERTY_NOT_FOUND'; end if;
  if not exists (
    select 1 from public.leads where id = p_buyer_dossier_id and contact_id = p_buyer_contact_id
      and archived = false and pipeline_type = 'BUYER'
  ) then raise exception 'COMMERCIAL_BUYER_CASE_INVALID'; end if;
  if not exists (select 1 from public.profiles where id = p_responsible_user_id and is_active = true) then raise exception 'COMMERCIAL_ASSIGNEE_INVALID'; end if;
  if p_visit_id is not null and not exists (
    select 1 from public.appointments where id = p_visit_id and appointment_type = 'VISIT'
      and property_id = p_property_id and contact_id = p_buyer_contact_id
  ) then raise exception 'COMMERCIAL_VISIT_RELATION_INVALID'; end if;

  created_status := case when p_submission = 'draft' then 'DRAFT' else 'TO_BE_SIGNED' end;
  insert into public.offers(
    id, lead_id, contact_id, property_id, assigned_to, buyer_dossier_id,
    buyer_contact_id, responsible_user_id, created_by, amount, status,
    offered_at, expires_at, offer_date, valid_until, financing_type,
    down_payment_amount, loan_amount, suspensive_conditions, included_furniture,
    negotiation_comment, notes, created_from_visit_id, next_action, next_action_due_at, is_test
  ) values (
    created_id, p_buyer_dossier_id, p_buyer_contact_id, p_property_id, p_responsible_user_id,
    p_buyer_dossier_id, p_buyer_contact_id, p_responsible_user_id, p_actor_id, p_amount, created_status,
    p_offer_date::timestamptz, (p_valid_until + 1)::timestamptz - interval '1 millisecond',
    p_offer_date, p_valid_until, p_financing_type, p_down_payment_amount, p_loan_amount,
    nullif(btrim(p_suspensive_conditions), ''), nullif(btrim(p_included_furniture), ''),
    nullif(btrim(p_negotiation_comment), ''), nullif(btrim(p_negotiation_comment), ''), p_visit_id,
    case when created_status = 'DRAFT' then 'Completer le brouillon' else 'Faire signer l''offre' end,
    now() + interval '1 day', false
  );

  insert into public.offer_status_history(offer_id, previous_status, next_status, changed_by, metadata)
  values (created_id, null, created_status, p_actor_id, jsonb_build_object('source', 'crm.commercial.offer.create'));
  update public.leads set linked_property_id = coalesce(linked_property_id, p_property_id),
    pipeline_stage = 'BUYER_OFFER', stage_entered_at = now(), updated_at = now()
  where id = p_buyer_dossier_id;
  insert into public.activities(entity_type, entity_id, action, user_name, actor_id, metadata)
  values ('offer', created_id,
    case when created_status = 'DRAFT' then 'Brouillon offre cree' else 'Offre creee' end,
    coalesce(nullif(btrim(p_actor_name), ''), 'Utilisateur CRM'), p_actor_id,
    jsonb_build_object('property_id', p_property_id, 'buyer_dossier_id', p_buyer_dossier_id,
      'buyer_contact_id', p_buyer_contact_id, 'visit_id', p_visit_id, 'status', created_status));
  return jsonb_build_object('offer_id', created_id, 'status', created_status);
end;
$$;

revoke all on function public.move_commercial_pipeline(uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function public.create_commercial_case(uuid, text, uuid, uuid, uuid, text, text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.transform_commercial_estimation(uuid, numeric, text, uuid, text) from public, anon, authenticated;
revoke all on function public.create_commercial_visit(uuid, uuid, uuid, uuid, timestamptz, timestamptz, text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.update_commercial_visit(uuid, text, text, timestamptz, timestamptz, uuid, text) from public, anon, authenticated;
revoke all on function public.submit_commercial_visit_report(uuid, text, text[], text[], integer, text, text, timestamptz, uuid, text) from public, anon, authenticated;
revoke all on function public.create_commercial_offer(uuid, uuid, uuid, uuid, uuid, numeric, date, date, text, numeric, numeric, text, text, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.move_commercial_pipeline(uuid, text, uuid, text) to service_role;
grant execute on function public.create_commercial_case(uuid, text, uuid, uuid, uuid, text, text, text, uuid, text) to service_role;
grant execute on function public.transform_commercial_estimation(uuid, numeric, text, uuid, text) to service_role;
grant execute on function public.create_commercial_visit(uuid, uuid, uuid, uuid, timestamptz, timestamptz, text, text, uuid, text) to service_role;
grant execute on function public.update_commercial_visit(uuid, text, text, timestamptz, timestamptz, uuid, text) to service_role;
grant execute on function public.submit_commercial_visit_report(uuid, text, text[], text[], integer, text, text, timestamptz, uuid, text) to service_role;
grant execute on function public.create_commercial_offer(uuid, uuid, uuid, uuid, uuid, numeric, date, date, text, numeric, numeric, text, text, text, text, uuid, text) to service_role;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values
  ('estimation-reports', 'estimation-reports', false, 10485760, array['application/pdf']),
  ('offer-documents', 'offer-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.leads replica identity full;
alter table public.estimations replica identity full;
alter table public.appointments replica identity full;
alter table public.offers replica identity full;
alter table public.tasks replica identity full;
alter table public.activities replica identity full;

alter table public.offer_documents validate constraint offer_documents_file_size_check;
alter table public.offer_documents validate constraint offer_documents_status_check;
alter table public.offer_documents validate constraint offer_documents_confidentiality_check;
alter table public.offer_documents validate constraint offer_documents_version_check;
alter table public.appointments validate constraint appointments_report_next_action_check;

do $$
declare relation_name text;
begin
  foreach relation_name in array array['leads', 'estimations', 'appointments', 'offers', 'tasks', 'activities']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = relation_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', relation_name);
    end if;
  end loop;
end
$$;
