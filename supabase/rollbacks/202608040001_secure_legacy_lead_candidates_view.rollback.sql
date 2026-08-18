-- Safe rollback for 202608040001_secure_legacy_lead_candidates_view.sql.
-- This restores owner-executed view semantics for compatibility, but it does
-- not restore the unsafe PUBLIC or anon grants.

begin;

do $$
begin
  if to_regclass('public.crm_legacy_lead_candidates') is null then
    raise exception 'Required view public.crm_legacy_lead_candidates does not exist';
  end if;
end
$$;

alter view public.crm_legacy_lead_candidates
  reset (security_invoker, security_barrier);

revoke all privileges on table public.crm_legacy_lead_candidates from public;
revoke all privileges on table public.crm_legacy_lead_candidates from anon;
revoke all privileges on table public.crm_legacy_lead_candidates from authenticated;
revoke all privileges on table public.crm_legacy_lead_candidates from service_role;

grant select on table public.crm_legacy_lead_candidates to authenticated;
grant select on table public.crm_legacy_lead_candidates to service_role;

comment on view public.crm_legacy_lead_candidates is
  'Sensitive legacy CRM review view. PUBLIC and anon access remain forbidden after rollback.';

commit;
