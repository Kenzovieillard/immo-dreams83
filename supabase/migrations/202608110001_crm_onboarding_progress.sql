-- Persist the CRM onboarding checklist for each authenticated admin profile.

set lock_timeout = '5s';
set statement_timeout = '30s';

create table if not exists public.crm_onboarding_progress (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  profile_completed boolean not null default false,
  contacts_completed boolean not null default false,
  pipeline_completed boolean not null default false,
  appointment_completed boolean not null default false,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

drop trigger if exists crm_onboarding_progress_set_updated_at on public.crm_onboarding_progress;
create trigger crm_onboarding_progress_set_updated_at
  before update on public.crm_onboarding_progress
  for each row execute function public.set_updated_at();

alter table public.crm_onboarding_progress enable row level security;

drop policy if exists "Admins can read own onboarding progress" on public.crm_onboarding_progress;
create policy "Admins can read own onboarding progress"
  on public.crm_onboarding_progress for select to authenticated
  using (user_id = auth.uid() and public.is_active_admin());

drop policy if exists "Admins can create own onboarding progress" on public.crm_onboarding_progress;
create policy "Admins can create own onboarding progress"
  on public.crm_onboarding_progress for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_admin());

drop policy if exists "Admins can update own onboarding progress" on public.crm_onboarding_progress;
create policy "Admins can update own onboarding progress"
  on public.crm_onboarding_progress for update to authenticated
  using (user_id = auth.uid() and public.is_active_admin())
  with check (user_id = auth.uid() and public.is_active_admin());
