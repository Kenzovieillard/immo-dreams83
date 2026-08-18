-- Validate commercial pipeline CHECK constraints after the CRM offers recipe.
-- Preconditions verified on 2026-08-04:
-- - a test offer was created with is_test=true;
-- - status history recorded DRAFT -> TO_BE_SIGNED -> WITHDRAWN;
-- - all candidate violation counters returned 0.

set lock_timeout = '5s';
set statement_timeout = '30s';

alter table public.tasks
  validate constraint tasks_status_check;

alter table public.appointments
  validate constraint appointments_type_check;

alter table public.offers
  validate constraint offers_status_check;

alter table public.offers
  validate constraint offers_amount_check;

alter table public.offers
  validate constraint offers_financing_type_check;

alter table public.offers
  validate constraint offers_validity_check;

alter table public.offers
  validate constraint offers_required_relationships_check;
