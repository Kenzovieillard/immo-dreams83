begin;

create table public.crm_sales (
  property_id uuid primary key references public.properties(id) on delete restrict,
  advisor_id uuid references public.profiles(id) on delete set null,
  signed_on date not null check (signed_on >= date '2000-01-01'),
  sale_price numeric(14,2) not null check (sale_price > 0),
  fee_excl_tax numeric(14,2) not null check (fee_excl_tax >= 0 and fee_excl_tax <= sale_price),
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index crm_sales_signed_on_idx on public.crm_sales(signed_on, property_id);
create index crm_sales_advisor_idx on public.crm_sales(advisor_id, signed_on);
alter table public.crm_sales enable row level security;
revoke all on public.crm_sales from public, anon, authenticated;
grant select, insert, update on public.crm_sales to service_role;

create function public.record_crm_sale(
  p_actor uuid, p_property uuid, p_advisor uuid,
  p_signed_on date, p_sale_price numeric, p_fee numeric, p_expected timestamptz
) returns text
language plpgsql set search_path = '' as $$
declare
  prior public.crm_sales%rowtype;
  listing record;
begin
  if not exists (select 1 from public.profiles
    where id = p_actor and is_active and role in ('ADMIN', 'DIRECTOR')) then
    return 'forbidden';
  end if;
  if p_advisor is not null and not exists (select 1 from public.profiles
    where id = p_advisor and role in ('ADMIN', 'DIRECTOR', 'AGENT')) then
    return 'invalid';
  end if;
  if p_signed_on is null or p_signed_on > (now() at time zone 'Europe/Paris')::date
    or p_signed_on < date '2000-01-01' or p_sale_price is null or p_sale_price <= 0
    or p_fee is null or p_fee < 0 or p_fee > p_sale_price then
    return 'invalid';
  end if;
  select commercial_status, status, transaction_type into listing from public.properties
    where id = p_property for update;
  if not found then return 'missing'; end if;
  select * into prior from public.crm_sales where property_id = p_property;
  if found then
    if prior.signed_on = p_signed_on and prior.sale_price = p_sale_price
      and prior.fee_excl_tax = p_fee and prior.advisor_id is not distinct from p_advisor then
      return 'ok';
    end if;
    if prior.updated_at is distinct from p_expected then return 'conflict'; end if;
    update public.crm_sales set signed_on = p_signed_on, sale_price = p_sale_price,
      fee_excl_tax = p_fee, advisor_id = p_advisor, updated_at = clock_timestamp()
      where property_id = p_property;
    return 'ok';
  end if;
  if p_expected is not null then return 'conflict'; end if;
  if listing.transaction_type <> 'sale'
    or coalesce(listing.commercial_status, upper(listing.status)) is distinct from 'SOLD' then
    return 'invalid_state';
  end if;
  insert into public.crm_sales(property_id, advisor_id, signed_on, sale_price, fee_excl_tax, recorded_by)
    values (p_property, p_advisor, p_signed_on, p_sale_price, p_fee, p_actor);
  return 'ok';
end;
$$;

revoke all on function public.record_crm_sale(uuid,uuid,uuid,date,numeric,numeric,timestamptz)
  from public, anon, authenticated;
grant execute on function public.record_crm_sale(uuid,uuid,uuid,date,numeric,numeric,timestamptz)
  to service_role;

commit;
