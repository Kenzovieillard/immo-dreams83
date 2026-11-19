-- CRM Riviera v2 - module Commercial Figma (Pipeline, Estimations, Visites, Offres).
-- Migration additive: les colonnes historiques restent disponibles et aucune donnee n'est supprimee.

set lock_timeout = '5s';
set statement_timeout = '60s';

alter table public.leads add column if not exists pipeline_type text not null default 'BUYER';
alter table public.leads add column if not exists pipeline_stage text;
alter table public.leads add column if not exists stage_entered_at timestamptz not null default now();
alter table public.leads add column if not exists is_blocked boolean not null default false;
alter table public.leads add column if not exists blocking_reason text;
alter table public.leads add column if not exists estimated_budget numeric;
alter table public.leads add column if not exists financing_approved boolean not null default false;
alter table public.leads add column if not exists expected_signature_date date;
alter table public.leads add column if not exists commercial_alert text;

update public.leads
set
  pipeline_stage = coalesce(
    pipeline_stage,
    case status
      when 'NEW' then 'BUYER_NEW'
      when 'CONTACTED' then 'BUYER_QUALIFIED'
      when 'APPOINTMENT' then 'BUYER_VISIT'
      when 'MANDATE_SIGNED' then 'BUYER_FINALIZED'
      when 'LOST' then 'BUYER_FINALIZED'
      else 'BUYER_NEW'
    end
  ),
  estimated_budget = coalesce(estimated_budget, budget_max, budget_min)
where pipeline_stage is null or estimated_budget is null;

alter table public.leads drop constraint if exists leads_pipeline_type_check;
alter table public.leads
  add constraint leads_pipeline_type_check
  check (pipeline_type in ('BUYER', 'SELLER')) not valid;

alter table public.leads drop constraint if exists leads_pipeline_stage_check;
alter table public.leads
  add constraint leads_pipeline_stage_check
  check (pipeline_stage in (
    'BUYER_NEW', 'BUYER_QUALIFIED', 'BUYER_VISIT', 'BUYER_OFFER', 'BUYER_COMPROMISE', 'BUYER_FINALIZED',
    'SELLER_NEW', 'SELLER_CONTACT', 'SELLER_ESTIMATE_SCHEDULED', 'SELLER_ESTIMATE_DONE',
    'SELLER_MANDATE_PROPOSED', 'SELLER_MANDATE_SIGNED', 'SELLER_MARKETED'
  )) not valid;

create index if not exists leads_pipeline_board_idx
  on public.leads(pipeline_type, pipeline_stage, stage_entered_at);
create index if not exists leads_pipeline_alert_idx
  on public.leads(is_blocked, updated_at desc);

alter table public.estimations add column if not exists commercial_reference text;
alter table public.estimations add column if not exists contact_id uuid references public.contacts(id) on delete set null;
alter table public.estimations add column if not exists property_address text;
alter table public.estimations add column if not exists construction_year integer;
alter table public.estimations add column if not exists property_condition text;
alter table public.estimations add column if not exists requested_at date not null default current_date;
alter table public.estimations add column if not exists appointment_at timestamptz;
alter table public.estimations add column if not exists time_slot text;
alter table public.estimations add column if not exists duration_minutes integer not null default 60;
alter table public.estimations add column if not exists appointment_location text;
alter table public.estimations add column if not exists commercial_status text not null default 'NEW_REQUEST';
alter table public.estimations add column if not exists estimated_value numeric;
alter table public.estimations add column if not exists estimate_low numeric;
alter table public.estimations add column if not exists estimate_high numeric;
alter table public.estimations add column if not exists market_comparables jsonb not null default '[]'::jsonb;
alter table public.estimations add column if not exists report_storage_path text;
alter table public.estimations add column if not exists report_generated_at timestamptz;
alter table public.estimations add column if not exists converted_property_id uuid references public.properties(id) on delete set null;
alter table public.estimations add column if not exists converted_to_property boolean not null default false;
alter table public.estimations add column if not exists selected_mandate_type text;
alter table public.estimations add column if not exists listing_price numeric;
alter table public.estimations add column if not exists assigned_to uuid references public.profiles(id) on delete set null;

update public.estimations
set commercial_reference = 'EST-' || upper(substr(replace(id::text, '-', ''), 1, 8))
where commercial_reference is null;

create unique index if not exists estimations_commercial_reference_idx
  on public.estimations(commercial_reference)
  where commercial_reference is not null;
create index if not exists estimations_commercial_status_idx
  on public.estimations(commercial_status, appointment_at);

alter table public.estimations drop constraint if exists estimations_commercial_status_check;
alter table public.estimations
  add constraint estimations_commercial_status_check
  check (commercial_status in (
    'NEW_REQUEST', 'TO_CONTACT', 'SCHEDULED', 'COMPLETED', 'REPORT_SENT', 'NO_FOLLOW_UP', 'FINISHED'
  )) not valid;

alter table public.appointments add column if not exists contact_id uuid references public.contacts(id) on delete set null;
alter table public.appointments add column if not exists visit_status text not null default 'TO_CONFIRM';
alter table public.appointments add column if not exists general_impression text;
alter table public.appointments add column if not exists positive_points text[] not null default '{}';
alter table public.appointments add column if not exists blocking_points text[] not null default '{}';
alter table public.appointments add column if not exists interest_level integer;
alter table public.appointments add column if not exists additional_comments text;
alter table public.appointments add column if not exists report_next_action text;
alter table public.appointments add column if not exists report_submitted_at timestamptz;
alter table public.appointments add column if not exists satisfaction_rating integer;

alter table public.appointments drop constraint if exists appointments_visit_status_check;
alter table public.appointments
  add constraint appointments_visit_status_check
  check (visit_status in ('TO_CONFIRM', 'CONFIRMED', 'COMPLETED', 'CANCELLED')) not valid;
alter table public.appointments drop constraint if exists appointments_interest_level_check;
alter table public.appointments
  add constraint appointments_interest_level_check
  check (interest_level is null or interest_level between 1 and 5) not valid;
alter table public.appointments drop constraint if exists appointments_satisfaction_rating_check;
alter table public.appointments
  add constraint appointments_satisfaction_rating_check
  check (satisfaction_rating is null or satisfaction_rating between 1 and 5) not valid;

create index if not exists appointments_visit_calendar_idx
  on public.appointments(appointment_type, starts_at, visit_status);

alter table public.offers add column if not exists asking_price numeric;
alter table public.offers add column if not exists loan_duration_years integer;
alter table public.offers add column if not exists estimated_interest_rate numeric;

alter table public.offers drop constraint if exists offers_asking_price_check;
alter table public.offers
  add constraint offers_asking_price_check
  check (asking_price is null or asking_price > 0) not valid;

create table if not exists public.offer_negotiation_steps (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete cascade,
  step_number integer not null,
  label text not null,
  amount numeric,
  author_role text,
  step_status text not null default 'PENDING',
  comment text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (offer_id, step_number)
);

create table if not exists public.offer_exchanges (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete cascade,
  exchange_type text not null,
  amount numeric,
  author_id uuid references public.profiles(id) on delete set null,
  author_name text,
  comment text,
  created_at timestamptz not null default now()
);

alter table public.offer_negotiation_steps drop constraint if exists offer_negotiation_steps_author_role_check;
alter table public.offer_negotiation_steps
  add constraint offer_negotiation_steps_author_role_check
  check (author_role is null or author_role in ('BUYER', 'SELLER')) not valid;
alter table public.offer_negotiation_steps drop constraint if exists offer_negotiation_steps_status_check;
alter table public.offer_negotiation_steps
  add constraint offer_negotiation_steps_status_check
  check (step_status in ('PENDING', 'CURRENT', 'ACCEPTED', 'REJECTED')) not valid;

alter table public.offer_exchanges drop constraint if exists offer_exchanges_type_check;
alter table public.offer_exchanges
  add constraint offer_exchanges_type_check
  check (length(trim(exchange_type)) > 0) not valid;

create index if not exists offer_negotiation_steps_offer_idx
  on public.offer_negotiation_steps(offer_id, step_number);
create index if not exists offer_exchanges_offer_created_idx
  on public.offer_exchanges(offer_id, created_at desc);

alter table public.offer_negotiation_steps enable row level security;
alter table public.offer_exchanges enable row level security;

drop policy if exists "Active admins can read negotiation steps" on public.offer_negotiation_steps;
create policy "Active admins can read negotiation steps"
  on public.offer_negotiation_steps for select to authenticated
  using (public.is_active_admin());

drop policy if exists "Active admins can read offer exchanges" on public.offer_exchanges;
create policy "Active admins can read offer exchanges"
  on public.offer_exchanges for select to authenticated
  using (public.is_active_admin());

revoke all on table public.offer_negotiation_steps from anon;
revoke all on table public.offer_exchanges from anon;
revoke insert, update, delete on table public.offer_negotiation_steps from authenticated;
revoke insert, update, delete on table public.offer_exchanges from authenticated;
grant select on table public.offer_negotiation_steps to authenticated;
grant select on table public.offer_exchanges to authenticated;

create or replace view public.v_commercial_pipeline_stats as
select
  pipeline_type,
  pipeline_stage,
  count(*)::integer as dossier_count,
  coalesce(sum(estimated_budget), 0) as estimated_value,
  count(*) filter (where is_blocked)::integer as blocked_count
from public.leads
where archived = false
group by pipeline_type, pipeline_stage;

create or replace view public.v_commercial_estimation_stats as
select
  count(*) filter (where commercial_status = 'NEW_REQUEST')::integer as new_requests,
  count(*) filter (where commercial_status = 'TO_CONTACT')::integer as to_schedule,
  count(*) filter (
    where commercial_status = 'SCHEDULED'
      and appointment_at >= date_trunc('week', now())
      and appointment_at < date_trunc('week', now()) + interval '7 days'
  )::integer as scheduled_this_week,
  count(*) filter (
    where commercial_status = 'COMPLETED'
      and updated_at >= date_trunc('month', now())
  )::integer as completed_this_month,
  count(*) filter (
    where converted_to_property = true
      and updated_at >= date_trunc('month', now())
  )::integer as mandates_this_month
from public.estimations
where archived = false;

create or replace view public.v_commercial_visit_week_stats as
select
  count(*)::integer as total,
  count(*) filter (where visit_status = 'CONFIRMED')::integer as confirmed,
  count(*) filter (where visit_status = 'TO_CONFIRM')::integer as to_confirm,
  count(*) filter (where visit_status = 'COMPLETED' and report_submitted_at is null)::integer as reports_missing
from public.appointments
where appointment_type = 'VISIT'
  and starts_at >= date_trunc('week', now())
  and starts_at < date_trunc('week', now()) + interval '7 days';

alter view public.v_commercial_pipeline_stats set (security_invoker = true, security_barrier = true);
alter view public.v_commercial_estimation_stats set (security_invoker = true, security_barrier = true);
alter view public.v_commercial_visit_week_stats set (security_invoker = true, security_barrier = true);
revoke all on public.v_commercial_pipeline_stats from anon;
revoke all on public.v_commercial_estimation_stats from anon;
revoke all on public.v_commercial_visit_week_stats from anon;
grant select on public.v_commercial_pipeline_stats to authenticated;
grant select on public.v_commercial_estimation_stats to authenticated;
grant select on public.v_commercial_visit_week_stats to authenticated;

do $$
declare
  relation_name text;
begin
  foreach relation_name in array array['leads', 'estimations', 'appointments', 'offers', 'offer_negotiation_steps']
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = relation_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', relation_name);
    end if;
  end loop;
end
$$;
