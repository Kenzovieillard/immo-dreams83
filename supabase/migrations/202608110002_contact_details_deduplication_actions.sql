-- CRM Riviera contacts: detailed profile, ownership and safe duplicate merge.
-- Additive migration: existing rows remain valid and no contact is deleted.

alter table contacts add column if not exists assigned_to uuid references profiles(id) on delete set null;
alter table contacts add column if not exists address text;
alter table contacts add column if not exists postal_code text;
alter table contacts add column if not exists contact_preference text;
alter table contacts add column if not exists personal_situation text;
alter table contacts add column if not exists profession text;
alter table contacts add column if not exists current_residence text;
alter table contacts add column if not exists interest_score smallint;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'contacts_interest_score_check') then
    alter table contacts
      add constraint contacts_interest_score_check
      check (interest_score is null or interest_score between 0 and 100) not valid;
  end if;
end
$$;

alter table contacts validate constraint contacts_interest_score_check;

create index if not exists contacts_assigned_to_idx on contacts(assigned_to, archived, updated_at desc);
create index if not exists contacts_duplicate_review_idx on contacts(dedupe_status, archived, updated_at desc);

create or replace function public.merge_crm_contacts(
  p_primary_contact_id uuid,
  p_merged_contact_id uuid,
  p_actor_id uuid,
  p_actor_email text,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_primary contacts%rowtype;
  v_merged contacts%rowtype;
begin
  if p_primary_contact_id = p_merged_contact_id then
    raise exception 'Les deux contacts doivent être différents.';
  end if;

  if not exists (
    select 1 from profiles
    where id = p_actor_id
      and is_active = true
      and role in ('ADMIN', 'DIRECTOR', 'AGENT', 'ASSISTANT')
  ) then
    raise exception 'Droits insuffisants pour fusionner les contacts.';
  end if;

  select * into strict v_primary from contacts where id = p_primary_contact_id for update;
  select * into strict v_merged from contacts where id = p_merged_contact_id for update;

  if v_primary.archived or v_merged.archived then
    raise exception 'Un contact archivé ne peut pas être fusionné.';
  end if;

  update leads set contact_id = p_primary_contact_id where contact_id = p_merged_contact_id;
  update communications set contact_id = p_primary_contact_id where contact_id = p_merged_contact_id;
  update buyer_searches set contact_id = p_primary_contact_id where contact_id = p_merged_contact_id;
  update tasks set contact_id = p_primary_contact_id where contact_id = p_merged_contact_id;
  update offers set contact_id = p_primary_contact_id where contact_id = p_merged_contact_id;
  update offers set buyer_contact_id = p_primary_contact_id where buyer_contact_id = p_merged_contact_id;

  update contacts
  set
    phone = coalesce(nullif(phone, ''), v_merged.phone),
    email = coalesce(nullif(email, ''), v_merged.email),
    city = coalesce(nullif(city, ''), v_merged.city),
    address = coalesce(nullif(address, ''), v_merged.address),
    postal_code = coalesce(nullif(postal_code, ''), v_merged.postal_code),
    notes = concat_ws(E'\n', nullif(notes, ''), nullif(v_merged.notes, '')),
    interest_score = greatest(interest_score, v_merged.interest_score),
    dedupe_status = 'IGNORED',
    updated_at = now()
  where id = p_primary_contact_id;

  update contacts
  set
    canonical_contact_id = p_primary_contact_id,
    dedupe_status = 'MERGED',
    active_prospect = false,
    archived = true,
    updated_at = now()
  where id = p_merged_contact_id;

  insert into lead_merge_logs (
    primary_contact_id,
    merged_contact_id,
    match_category,
    matched_keys,
    previous_payload,
    next_payload,
    actor_id,
    actor_email,
    note
  ) values (
    p_primary_contact_id,
    p_merged_contact_id,
    'MANUAL_UI',
    to_jsonb(array_remove(array[
      case when v_primary.normalized_email = v_merged.normalized_email then 'email' else null end,
      case when v_primary.normalized_phone = v_merged.normalized_phone then 'phone' else null end
    ]::text[], null)),
    to_jsonb(v_merged),
    jsonb_build_object('canonical_contact_id', p_primary_contact_id, 'archived', true),
    p_actor_id,
    p_actor_email,
    nullif(trim(p_note), '')
  );

  return p_primary_contact_id;
end;
$$;

revoke all on function public.merge_crm_contacts(uuid, uuid, uuid, text, text) from public;
revoke all on function public.merge_crm_contacts(uuid, uuid, uuid, text, text) from anon;
revoke all on function public.merge_crm_contacts(uuid, uuid, uuid, text, text) from authenticated;
grant execute on function public.merge_crm_contacts(uuid, uuid, uuid, text, text) to service_role;
