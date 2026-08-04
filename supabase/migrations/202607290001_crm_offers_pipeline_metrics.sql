-- IMMO-DREAMS83 V3
-- Source of truth for buyer offers used by the commercial pipeline.
-- Additive migration: existing leads, mandates and appointments are unchanged.

create table if not exists offers (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  property_id uuid references properties(id) on delete restrict,
  assigned_to uuid references profiles(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  amount numeric,
  status text not null default 'DRAFT',
  offered_at timestamptz,
  expires_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'offers_status_check') then
    alter table offers
      add constraint offers_status_check
      check (status in ('DRAFT', 'SUBMITTED', 'NEGOTIATING', 'ACCEPTED', 'REFUSED', 'WITHDRAWN', 'EXPIRED'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'offers_amount_check') then
    alter table offers
      add constraint offers_amount_check
      check (amount is null or amount >= 0);
  end if;
end
$$;

drop trigger if exists offers_set_updated_at on offers;
create trigger offers_set_updated_at
  before update on offers
  for each row execute function set_updated_at();

create index if not exists offers_status_idx on offers(status);
create index if not exists offers_lead_id_idx on offers(lead_id);
create index if not exists offers_property_id_idx on offers(property_id);
create index if not exists offers_assigned_to_idx on offers(assigned_to);
create index if not exists offers_expires_at_idx on offers(expires_at);

alter table offers enable row level security;

drop policy if exists "Active admins can read offers" on offers;
create policy "Active admins can read offers"
  on offers for select to authenticated
  using (public.is_active_admin());
