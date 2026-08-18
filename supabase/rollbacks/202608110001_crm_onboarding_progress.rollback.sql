-- Remove only the per-user onboarding checklist introduced by 202608110001.

set lock_timeout = '5s';
set statement_timeout = '30s';

drop table if exists public.crm_onboarding_progress;
