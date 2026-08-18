-- IMMO-DREAMS83 security SEC-01
-- Prevent public access to the legacy CRM candidate view while preserving
-- authenticated CRM reads through the RLS policies of the source tables.

do $$
declare
  object_kind "char";
begin
  select c.relkind
  into object_kind
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'crm_legacy_lead_candidates';

  if object_kind is null then
    raise exception 'Required view public.crm_legacy_lead_candidates does not exist';
  end if;

  if object_kind <> 'v' then
    raise exception 'public.crm_legacy_lead_candidates is not a standard view';
  end if;
end
$$;

alter view public.crm_legacy_lead_candidates
  set (security_invoker = true, security_barrier = true);

revoke all privileges on table public.crm_legacy_lead_candidates from public;
revoke all privileges on table public.crm_legacy_lead_candidates from anon;
revoke all privileges on table public.crm_legacy_lead_candidates from authenticated;
revoke all privileges on table public.crm_legacy_lead_candidates from service_role;

grant select on table public.crm_legacy_lead_candidates to authenticated;
grant select on table public.crm_legacy_lead_candidates to service_role;

comment on view public.crm_legacy_lead_candidates is
  'Sensitive legacy CRM review view. Never grant access to PUBLIC or anon. Authenticated access is filtered by source-table RLS.';
