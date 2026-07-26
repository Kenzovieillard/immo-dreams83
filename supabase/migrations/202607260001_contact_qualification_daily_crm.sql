-- IMMO-DREAMS83 V3.1
-- Contact qualification and idempotent contact-to-pipeline linkage.
-- Additive only: existing contacts and leads remain intact.

alter table contacts add column if not exists contact_role text not null default 'UNKNOWN';
alter table contacts add column if not exists qualification_status text not null default 'TO_REVIEW';
alter table contacts add column if not exists qualification_source text not null default 'AUTO';
alter table contacts add column if not exists active_prospect boolean not null default false;
alter table contacts add column if not exists qualified_at timestamptz;
alter table contacts add column if not exists qualified_by uuid references profiles(id) on delete set null;
alter table contacts add column if not exists pipeline_lead_id uuid references leads(id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'contacts_contact_role_check') then
    alter table contacts
      add constraint contacts_contact_role_check
      check (contact_role in ('UNKNOWN', 'BUYER', 'SELLER', 'BOTH', 'OTHER')) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'contacts_qualification_status_check') then
    alter table contacts
      add constraint contacts_qualification_status_check
      check (qualification_status in ('TO_REVIEW', 'QUALIFIED', 'DUPLICATE', 'NO_CONTACT', 'INACTIVE')) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'contacts_qualification_source_check') then
    alter table contacts
      add constraint contacts_qualification_source_check
      check (qualification_source in ('AUTO', 'MANUAL')) not valid;
  end if;
end
$$;

create or replace function public.set_contact_qualification_defaults()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  has_real_email boolean;
  has_real_phone boolean;
  normalized_request text;
begin
  has_real_email :=
    nullif(trim(coalesce(new.email, '')), '') is not null
    and lower(new.email) not like '%@legacy.immo-dreams83.local';
  has_real_phone := nullif(regexp_replace(coalesce(new.phone, ''), '\D', '', 'g'), '') is not null;
  normalized_request := lower(coalesce(new.request_type, ''));

  if new.qualification_source = 'AUTO' or new.contact_role = 'UNKNOWN' then
    new.contact_role := case
      when normalized_request ~ '(mixte|vendeur.*acqu[ée]reur|acqu[ée]reur.*vendeur)' then 'BOTH'
      when normalized_request ~ '(acqu[ée]reur|achat|recherche|locataire)' then 'BUYER'
      when normalized_request ~ '(vendeur|vente|estimation|bailleur)' then 'SELLER'
      when nullif(normalized_request, '') is not null and normalized_request <> 'contact lesty' then 'OTHER'
      else 'UNKNOWN'
    end;
  end if;

  if not has_real_email and not has_real_phone then
    new.qualification_status := 'NO_CONTACT';
    new.active_prospect := false;
  elsif new.archived or new.status = 'LOST' then
    new.qualification_status := case
      when new.qualification_status = 'DUPLICATE' then 'DUPLICATE'
      else 'INACTIVE'
    end;
    new.active_prospect := false;
  elsif new.qualification_status in ('DUPLICATE', 'NO_CONTACT', 'INACTIVE') then
    new.active_prospect := false;
  elsif new.qualification_source = 'AUTO' then
    new.qualification_status := 'TO_REVIEW';
    new.active_prospect := true;
  end if;

  return new;
end;
$$;

drop trigger if exists contacts_set_qualification_defaults on contacts;
create trigger contacts_set_qualification_defaults
  before insert or update of email, phone, request_type, archived, status on contacts
  for each row execute function public.set_contact_qualification_defaults();

update contacts
set
  contact_role = case
    when lower(coalesce(request_type, '')) ~ '(mixte|vendeur.*acqu[ée]reur|acqu[ée]reur.*vendeur)' then 'BOTH'
    when lower(coalesce(request_type, '')) ~ '(acqu[ée]reur|achat|recherche|locataire)' then 'BUYER'
    when lower(coalesce(request_type, '')) ~ '(vendeur|vente|estimation|bailleur)' then 'SELLER'
    when nullif(trim(request_type), '') is not null and lower(trim(request_type)) <> 'contact lesty' then 'OTHER'
    else 'UNKNOWN'
  end,
  qualification_status = case
    when
      (
        nullif(trim(coalesce(email, '')), '') is null
        or lower(email) like '%@legacy.immo-dreams83.local'
      )
      and nullif(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), '') is null
      then 'NO_CONTACT'
    when archived or status = 'LOST' then 'INACTIVE'
    when dedupe_status = 'MERGED' then 'DUPLICATE'
    else 'TO_REVIEW'
  end,
  qualification_source = 'AUTO',
  active_prospect = case
    when archived or status = 'LOST' or dedupe_status = 'MERGED' then false
    when
      (
        nullif(trim(coalesce(email, '')), '') is null
        or lower(email) like '%@legacy.immo-dreams83.local'
      )
      and nullif(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), '') is null
      then false
    else true
  end
where qualification_source = 'AUTO';

update contacts as contact
set pipeline_lead_id = linked_lead.id
from (
  select distinct on (contact_id)
    id,
    contact_id
  from leads
  where contact_id is not null
    and archived = false
  order by contact_id, updated_at desc
) as linked_lead
where contact.id = linked_lead.contact_id
  and contact.pipeline_lead_id is null;

create index if not exists contacts_qualification_status_idx
  on contacts(archived, qualification_status, active_prospect);
create index if not exists contacts_contact_role_idx on contacts(contact_role);
create index if not exists contacts_pipeline_lead_idx on contacts(pipeline_lead_id);
create index if not exists leads_contact_active_idx on leads(contact_id, archived, updated_at desc);
