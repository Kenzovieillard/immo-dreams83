-- CRM Riviera v2 - autonomous Negotiations hub.
-- Additive and compatible with the existing offers/properties/contacts/profiles source of truth.

set lock_timeout = '5s';
set statement_timeout = '60s';

create extension if not exists pg_cron with schema pg_catalog;

create table if not exists public.negotiations (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null unique references public.offers(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete restrict,
  buyer_contact_id uuid not null references public.contacts(id) on delete restrict,
  seller_contact_id uuid references public.contacts(id) on delete set null,
  responsible_user_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'IN_PROGRESS',
  initial_amount numeric not null,
  current_amount numeric not null,
  asking_price numeric not null,
  current_gap_percent numeric(7,2),
  current_step integer not null default 1,
  total_steps integer not null default 4,
  response_deadline date,
  is_urgent boolean not null default false,
  days_without_activity integer not null default 0,
  last_activity_at timestamptz not null default now(),
  final_amount numeric,
  concluded_at timestamptz,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.negotiations drop constraint if exists negotiations_status_check;
alter table public.negotiations add constraint negotiations_status_check
  check (status in (
    'IN_PROGRESS', 'WAITING_SELLER', 'WAITING_BUYER', 'COUNTER_OFFER',
    'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONCLUDED'
  )) not valid;
alter table public.negotiations drop constraint if exists negotiations_amounts_check;
alter table public.negotiations add constraint negotiations_amounts_check
  check (initial_amount > 0 and current_amount > 0 and asking_price > 0) not valid;
alter table public.negotiations drop constraint if exists negotiations_steps_check;
alter table public.negotiations add constraint negotiations_steps_check
  check (current_step > 0 and total_steps >= current_step) not valid;

create index if not exists negotiations_status_idx on public.negotiations(status);
create index if not exists negotiations_urgent_idx on public.negotiations(is_urgent) where is_urgent = true;
create index if not exists negotiations_responsible_idx on public.negotiations(responsible_user_id);
create index if not exists negotiations_property_idx on public.negotiations(property_id);
create index if not exists negotiations_deadline_idx on public.negotiations(response_deadline);

create table if not exists public.negotiation_steps (
  id uuid primary key default gen_random_uuid(),
  negotiation_id uuid not null references public.negotiations(id) on delete cascade,
  step_number integer not null,
  label text not null,
  amount numeric,
  author_role text,
  step_status text not null default 'PENDING',
  is_current boolean not null default false,
  comment text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (negotiation_id, step_number)
);

alter table public.negotiation_steps drop constraint if exists negotiation_steps_author_check;
alter table public.negotiation_steps add constraint negotiation_steps_author_check
  check (author_role is null or author_role in ('BUYER', 'SELLER')) not valid;
alter table public.negotiation_steps drop constraint if exists negotiation_steps_status_check;
alter table public.negotiation_steps add constraint negotiation_steps_status_check
  check (step_status in ('SENT', 'REVIEW', 'ACCEPTED', 'REJECTED', 'PENDING')) not valid;
create index if not exists negotiation_steps_negotiation_idx
  on public.negotiation_steps(negotiation_id, step_number);

create table if not exists public.negotiation_exchanges (
  id uuid primary key default gen_random_uuid(),
  negotiation_id uuid not null references public.negotiations(id) on delete cascade,
  exchange_type text not null,
  amount numeric,
  author_id uuid references public.profiles(id) on delete set null,
  author_name text,
  comment text,
  is_internal_note boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists negotiation_exchanges_created_idx
  on public.negotiation_exchanges(negotiation_id, created_at desc);

create table if not exists public.negotiation_documents (
  id uuid primary key default gen_random_uuid(),
  negotiation_id uuid not null references public.negotiations(id) on delete cascade,
  file_name text not null,
  storage_bucket text not null default 'negotiation-documents',
  storage_path text not null,
  document_type text,
  mime_type text,
  document_status text not null default 'READY',
  version integer not null default 1,
  confidentiality text not null default 'PRIVATE',
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists negotiation_documents_negotiation_idx
  on public.negotiation_documents(negotiation_id, created_at desc);
alter table public.negotiation_documents drop constraint if exists negotiation_documents_status_check;
alter table public.negotiation_documents add constraint negotiation_documents_status_check
  check (document_status in ('DRAFT', 'READY', 'SENT', 'SIGNED', 'REJECTED', 'EXPIRED', 'ARCHIVED', 'CANCELLED')) not valid;
alter table public.negotiation_documents drop constraint if exists negotiation_documents_confidentiality_check;
alter table public.negotiation_documents add constraint negotiation_documents_confidentiality_check
  check (confidentiality in ('PRIVATE', 'AGENCY', 'PARTIES')) not valid;
alter table public.negotiation_documents drop constraint if exists negotiation_documents_version_check;
alter table public.negotiation_documents add constraint negotiation_documents_version_check
  check (version > 0) not valid;

create table if not exists public.negotiation_alert_events (
  id uuid primary key default gen_random_uuid(),
  negotiation_id uuid not null references public.negotiations(id) on delete cascade,
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  alert_type text not null,
  alert_date date not null default current_date,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (negotiation_id, alert_type, alert_date)
);

alter table public.negotiation_alert_events drop constraint if exists negotiation_alert_events_type_check;
alter table public.negotiation_alert_events add constraint negotiation_alert_events_type_check
  check (alert_type in ('DEADLINE_48H', 'FOLLOW_UP_REQUIRED')) not valid;
create index if not exists negotiation_alert_events_recipient_idx
  on public.negotiation_alert_events(recipient_user_id, read_at, created_at desc);

create or replace function public.prepare_negotiation_metrics()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.asking_price > 0 then
    new.current_gap_percent := round(((new.current_amount - new.asking_price) / new.asking_price) * 100, 2);
  end if;
  new.is_urgent := new.response_deadline is not null
    and new.response_deadline <= current_date + 2
    and new.status not in ('ACCEPTED', 'REJECTED', 'EXPIRED', 'CONCLUDED');
  new.days_without_activity := greatest(0, extract(day from now() - coalesce(new.last_activity_at, new.created_at))::integer);
  if new.status in ('ACCEPTED', 'CONCLUDED') then
    new.final_amount := coalesce(new.final_amount, new.current_amount);
    new.concluded_at := coalesce(new.concluded_at, now());
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists negotiations_prepare_metrics on public.negotiations;
create trigger negotiations_prepare_metrics
  before insert or update on public.negotiations
  for each row execute function public.prepare_negotiation_metrics();

create or replace function public.create_negotiation_from_offer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  property_price numeric;
  negotiation_id uuid;
  property_seller_contact_id uuid;
begin
  if new.status = 'NEGOTIATING'
     and new.property_id is not null
     and new.buyer_contact_id is not null
     and new.responsible_user_id is not null
     and new.amount is not null
     and not exists (select 1 from public.negotiations where offer_id = new.id) then
    select price into property_price from public.properties where id = new.property_id;
    select l.contact_id
      into property_seller_contact_id
      from public.mandates m
      join public.leads l on l.id = m.lead_id
     where m.property_id = new.property_id
       and l.contact_id is not null
     order by m.updated_at desc
     limit 1;
    insert into public.negotiations (
      offer_id, property_id, buyer_contact_id, seller_contact_id, responsible_user_id,
      initial_amount, current_amount, asking_price, status, response_deadline
    ) values (
      new.id, new.property_id, new.buyer_contact_id, property_seller_contact_id, new.responsible_user_id,
      new.amount, new.amount, coalesce(new.asking_price, property_price, new.amount),
      'IN_PROGRESS', coalesce(new.valid_until, new.expires_at::date)
    ) returning id into negotiation_id;

    insert into public.negotiation_steps (
      negotiation_id, step_number, label, amount, author_role, step_status, is_current, created_by
    ) values (
      negotiation_id, 1, 'Offre initiale', new.amount, 'BUYER', 'SENT', true, new.created_by
    );
  end if;
  return new;
end;
$$;

drop trigger if exists offers_create_negotiation on public.offers;
create trigger offers_create_negotiation
  after insert or update of status on public.offers
  for each row execute function public.create_negotiation_from_offer();

create or replace function public.sync_negotiation_from_step()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.negotiation_steps
  set is_current = false
  where negotiation_id = new.negotiation_id and id <> new.id and is_current = true;

  update public.negotiations
  set current_amount = coalesce(new.amount, current_amount),
      current_step = new.step_number,
      total_steps = greatest(total_steps, new.step_number),
      last_activity_at = now(),
      status = case
        when new.step_status = 'ACCEPTED' then 'ACCEPTED'
        when new.step_status = 'REJECTED' then 'REJECTED'
        when new.author_role = 'SELLER' then 'WAITING_BUYER'
        when new.author_role = 'BUYER' then 'WAITING_SELLER'
        else status
      end
  where id = new.negotiation_id;
  return new;
end;
$$;

drop trigger if exists negotiation_steps_sync_parent on public.negotiation_steps;
create trigger negotiation_steps_sync_parent
  after insert on public.negotiation_steps
  for each row execute function public.sync_negotiation_from_step();

create or replace function public.add_negotiation_proposal(
  p_negotiation_id uuid,
  p_amount numeric,
  p_author_role text,
  p_comment text,
  p_response_deadline date,
  p_actor_id uuid,
  p_actor_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  next_step integer;
  created_step_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'NEGOTIATION_AMOUNT_INVALID';
  end if;
  if p_author_role not in ('BUYER', 'SELLER') then
    raise exception 'NEGOTIATION_AUTHOR_INVALID';
  end if;

  select current_step + 1
    into next_step
    from public.negotiations
   where id = p_negotiation_id
     and status not in ('ACCEPTED', 'REJECTED', 'EXPIRED', 'CONCLUDED')
   for update;
  if next_step is null then
    raise exception 'NEGOTIATION_NOT_ACTIONABLE';
  end if;

  insert into public.negotiation_steps (
    negotiation_id, step_number, label, amount, author_role,
    step_status, is_current, comment, created_by
  ) values (
    p_negotiation_id,
    next_step,
    case when p_author_role = 'SELLER' then 'Contre-proposition vendeur' else 'Nouvelle offre acquéreur' end,
    p_amount,
    p_author_role,
    'SENT',
    true,
    nullif(btrim(p_comment), ''),
    p_actor_id
  )
  returning id into created_step_id;

  update public.negotiations
     set response_deadline = p_response_deadline
   where id = p_negotiation_id;

  insert into public.negotiation_exchanges (
    negotiation_id, exchange_type, amount, author_id, author_name, comment
  ) values (
    p_negotiation_id,
    case when p_author_role = 'SELLER' then 'Contre-proposition du vendeur' else 'Nouvelle offre acquéreur' end,
    p_amount,
    p_actor_id,
    nullif(btrim(p_actor_name), ''),
    nullif(btrim(p_comment), '')
  );

  return created_step_id;
end;
$$;

revoke all on function public.add_negotiation_proposal(uuid, numeric, text, text, date, uuid, text) from public, anon, authenticated;
grant execute on function public.add_negotiation_proposal(uuid, numeric, text, text, date, uuid, text) to service_role;

create or replace function public.decide_negotiation(
  p_negotiation_id uuid,
  p_status text,
  p_comment text,
  p_actor_id uuid,
  p_actor_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  negotiation_amount numeric;
begin
  if p_status not in ('ACCEPTED', 'REJECTED') then
    raise exception 'NEGOTIATION_DECISION_INVALID';
  end if;
  if p_status = 'REJECTED' and nullif(btrim(p_comment), '') is null then
    raise exception 'NEGOTIATION_REJECTION_REASON_REQUIRED';
  end if;

  select current_amount
    into negotiation_amount
    from public.negotiations
   where id = p_negotiation_id
     and status not in ('ACCEPTED', 'REJECTED', 'EXPIRED', 'CONCLUDED')
   for update;
  if negotiation_amount is null then
    raise exception 'NEGOTIATION_NOT_ACTIONABLE';
  end if;

  update public.negotiations
     set status = p_status,
         final_amount = case when p_status = 'ACCEPTED' then negotiation_amount else null end,
         concluded_at = now(),
         last_activity_at = now()
   where id = p_negotiation_id;

  insert into public.negotiation_exchanges (
    negotiation_id, exchange_type, amount, author_id, author_name, comment
  ) values (
    p_negotiation_id,
    case when p_status = 'ACCEPTED' then 'Offre acceptée' else 'Offre refusée' end,
    negotiation_amount,
    p_actor_id,
    nullif(btrim(p_actor_name), ''),
    nullif(btrim(p_comment), '')
  );
end;
$$;

revoke all on function public.decide_negotiation(uuid, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.decide_negotiation(uuid, text, text, uuid, text) to service_role;

create or replace function public.sync_offer_from_negotiation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status or new.current_amount is distinct from old.current_amount then
    update public.offers
    set status = case new.status
      when 'ACCEPTED' then 'ACCEPTED'
      when 'CONCLUDED' then 'ACCEPTED'
      when 'REJECTED' then 'REJECTED'
      when 'EXPIRED' then 'EXPIRED'
      else 'NEGOTIATING'
    end,
    amount = new.current_amount
    where id = new.offer_id;
  end if;
  return new;
end;
$$;

drop trigger if exists negotiations_sync_offer on public.negotiations;
create trigger negotiations_sync_offer
  after update of status, current_amount on public.negotiations
  for each row execute function public.sync_offer_from_negotiation();

create or replace function public.refresh_negotiation_alerts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update public.negotiations
  set is_urgent = response_deadline is not null and response_deadline <= current_date + 2,
      days_without_activity = greatest(0, extract(day from now() - coalesce(last_activity_at, created_at))::integer),
      updated_at = now()
  where status not in ('ACCEPTED', 'REJECTED', 'EXPIRED', 'CONCLUDED');
  get diagnostics affected = row_count;

  insert into public.negotiation_alert_events (
    negotiation_id, recipient_user_id, alert_type, alert_date
  )
  select
    id,
    responsible_user_id,
    case
      when response_deadline is not null and response_deadline <= current_date + 2 then 'DEADLINE_48H'
      else 'FOLLOW_UP_REQUIRED'
    end,
    current_date
  from public.negotiations
  where status not in ('ACCEPTED', 'REJECTED', 'EXPIRED', 'CONCLUDED')
    and (response_deadline <= current_date + 2 or days_without_activity >= 3)
  on conflict (negotiation_id, alert_type, alert_date) do nothing;

  return affected;
end;
$$;

alter table public.negotiations enable row level security;
alter table public.negotiation_steps enable row level security;
alter table public.negotiation_exchanges enable row level security;
alter table public.negotiation_documents enable row level security;
alter table public.negotiation_alert_events enable row level security;

drop policy if exists "Active admins can read negotiations" on public.negotiations;
create policy "Active admins can read negotiations" on public.negotiations
  for select to authenticated using (public.is_active_admin());
drop policy if exists "Active admins can read negotiation steps" on public.negotiation_steps;
create policy "Active admins can read negotiation steps" on public.negotiation_steps
  for select to authenticated using (public.is_active_admin());
drop policy if exists "Active admins can read negotiation exchanges" on public.negotiation_exchanges;
create policy "Active admins can read negotiation exchanges" on public.negotiation_exchanges
  for select to authenticated using (public.is_active_admin());
drop policy if exists "Active admins can read negotiation documents" on public.negotiation_documents;
create policy "Active admins can read negotiation documents" on public.negotiation_documents
  for select to authenticated using (public.is_active_admin());
drop policy if exists "Active admins can read negotiation alerts" on public.negotiation_alert_events;
create policy "Active admins can read negotiation alerts" on public.negotiation_alert_events
  for select to authenticated using (public.is_active_admin());

revoke all on public.negotiations, public.negotiation_steps, public.negotiation_exchanges, public.negotiation_documents, public.negotiation_alert_events from anon;
revoke insert, update, delete on public.negotiations, public.negotiation_steps, public.negotiation_exchanges, public.negotiation_documents, public.negotiation_alert_events from authenticated;
grant select on public.negotiations, public.negotiation_steps, public.negotiation_exchanges, public.negotiation_documents, public.negotiation_alert_events to authenticated;

create or replace view public.v_negotiations_kpi as
select
  count(*) filter (where status in ('IN_PROGRESS', 'WAITING_SELLER', 'WAITING_BUYER', 'COUNTER_OFFER'))::integer as active,
  count(*) filter (where status in ('WAITING_SELLER', 'WAITING_BUYER'))::integer as awaiting_response,
  count(*) filter (where is_urgent and status not in ('ACCEPTED', 'REJECTED', 'EXPIRED', 'CONCLUDED'))::integer as action_required,
  count(*) filter (where status in ('ACCEPTED', 'CONCLUDED') and concluded_at >= date_trunc('month', now()))::integer as accepted_this_month,
  round(avg(current_gap_percent) filter (where status in ('IN_PROGRESS', 'WAITING_SELLER', 'WAITING_BUYER', 'COUNTER_OFFER')), 1) as average_gap,
  coalesce(sum(current_amount) filter (where status in ('IN_PROGRESS', 'WAITING_SELLER', 'WAITING_BUYER', 'COUNTER_OFFER')), 0) as total_volume
from public.negotiations;

create or replace view public.v_negotiation_alerts as
select id, property_id, buyer_contact_id, response_deadline, days_without_activity,
  case when response_deadline <= current_date + 2 then 'DEADLINE_48H' else 'FOLLOW_UP_REQUIRED' end as alert_type
from public.negotiations
where status not in ('ACCEPTED', 'REJECTED', 'EXPIRED', 'CONCLUDED')
  and (response_deadline <= current_date + 2 or days_without_activity >= 3);

alter view public.v_negotiations_kpi set (security_invoker = true, security_barrier = true);
alter view public.v_negotiation_alerts set (security_invoker = true, security_barrier = true);
revoke all on public.v_negotiations_kpi, public.v_negotiation_alerts from anon;
grant select on public.v_negotiations_kpi, public.v_negotiation_alerts to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('negotiation-documents', 'negotiation-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

alter table public.negotiations replica identity full;
alter table public.negotiation_steps replica identity full;
alter table public.negotiation_exchanges replica identity full;

alter table public.negotiations validate constraint negotiations_status_check;
alter table public.negotiations validate constraint negotiations_amounts_check;
alter table public.negotiations validate constraint negotiations_steps_check;
alter table public.negotiation_steps validate constraint negotiation_steps_author_check;
alter table public.negotiation_steps validate constraint negotiation_steps_status_check;
alter table public.negotiation_documents validate constraint negotiation_documents_status_check;
alter table public.negotiation_documents validate constraint negotiation_documents_confidentiality_check;
alter table public.negotiation_documents validate constraint negotiation_documents_version_check;
alter table public.negotiation_alert_events validate constraint negotiation_alert_events_type_check;

do $$
declare relation_name text;
begin
  foreach relation_name in array array['negotiations', 'negotiation_steps', 'negotiation_exchanges', 'negotiation_alert_events']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = relation_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', relation_name);
    end if;
  end loop;
end
$$;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'refresh-negotiation-alerts-hourly-guard') then
    perform cron.schedule(
      'refresh-negotiation-alerts-hourly-guard',
      '0 * * * *',
      $job$
        select case
          when extract(hour from now() at time zone 'Europe/Paris') = 8
            then public.refresh_negotiation_alerts()
          else 0
        end;
      $job$
    );
  end if;
end
$$;
