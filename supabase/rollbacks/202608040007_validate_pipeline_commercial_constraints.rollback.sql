-- Conservative rollback for 202608040007.
-- PostgreSQL has no direct "unvalidate" command. This recreates the same
-- CHECK constraints as NOT VALID without changing CRM data.

set lock_timeout = '5s';
set statement_timeout = '30s';

alter table public.tasks drop constraint if exists tasks_status_check;
alter table public.tasks
  add constraint tasks_status_check
  check (status in ('TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')) not valid;

alter table public.appointments drop constraint if exists appointments_type_check;
alter table public.appointments
  add constraint appointments_type_check
  check (appointment_type in ('MEETING', 'VISIT', 'ESTIMATION', 'CALL')) not valid;

alter table public.offers drop constraint if exists offers_status_check;
alter table public.offers
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

alter table public.offers drop constraint if exists offers_amount_check;
alter table public.offers
  add constraint offers_amount_check
  check (amount is null or amount > 0) not valid;

alter table public.offers drop constraint if exists offers_financing_type_check;
alter table public.offers
  add constraint offers_financing_type_check
  check (financing_type in ('CASH', 'LOAN', 'MIXED', 'UNKNOWN')) not valid;

alter table public.offers drop constraint if exists offers_validity_check;
alter table public.offers
  add constraint offers_validity_check
  check (offer_date is null or valid_until is null or valid_until >= offer_date) not valid;

alter table public.offers drop constraint if exists offers_required_relationships_check;
alter table public.offers
  add constraint offers_required_relationships_check
  check (
    property_id is not null and
    buyer_dossier_id is not null and
    buyer_contact_id is not null and
    responsible_user_id is not null
  ) not valid;
