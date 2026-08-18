-- Conservative rollback for 202608040006.
-- It keeps newly created columns/tables to avoid data loss, but restores the
-- legacy offer status vocabulary and removes operational CHECK constraints.

begin;

drop trigger if exists leads_set_dossier_reference on public.leads;
drop function if exists public.set_lead_dossier_reference();

alter table public.tasks drop constraint if exists tasks_status_check;
alter table public.appointments drop constraint if exists appointments_type_check;
alter table public.offers drop constraint if exists offers_financing_type_check;
alter table public.offers drop constraint if exists offers_validity_check;
alter table public.offers drop constraint if exists offers_required_relationships_check;

update public.offers set status = 'SUBMITTED' where status = 'SENT_TO_SELLER';
update public.offers set status = 'REFUSED' where status = 'REJECTED';

alter table public.offers drop constraint if exists offers_status_check;
alter table public.offers
  add constraint offers_status_check
  check (status in ('DRAFT', 'SUBMITTED', 'NEGOTIATING', 'ACCEPTED', 'REFUSED', 'WITHDRAWN', 'EXPIRED')) not valid;

alter table public.offers drop constraint if exists offers_amount_check;
alter table public.offers
  add constraint offers_amount_check
  check (amount is null or amount >= 0) not valid;

commit;
