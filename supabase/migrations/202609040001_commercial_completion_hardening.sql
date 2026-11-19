-- Final hardening for the Commercial module.
-- Keeps offer transitions, their history and the optional negotiation in one transaction.

set lock_timeout = '5s';
set statement_timeout = '60s';

create or replace function public.transition_commercial_offer(
  p_offer_id uuid,
  p_next_status text,
  p_reason text,
  p_actor_id uuid,
  p_actor_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  offer_row public.offers%rowtype;
  normalized_reason text := nullif(btrim(p_reason), '');
begin
  select *
    into offer_row
    from public.offers
   where id = p_offer_id
   for update;

  if offer_row.id is null or offer_row.is_test then
    raise exception 'COMMERCIAL_OFFER_NOT_FOUND';
  end if;

  if not (
    (offer_row.status = 'DRAFT' and p_next_status in ('TO_BE_SIGNED', 'WITHDRAWN')) or
    (offer_row.status = 'TO_BE_SIGNED' and p_next_status in ('SIGNED_BY_BUYER', 'WITHDRAWN')) or
    (offer_row.status = 'SIGNED_BY_BUYER' and p_next_status in ('SENT_TO_SELLER', 'WITHDRAWN')) or
    (offer_row.status = 'SENT_TO_SELLER' and p_next_status in ('NEGOTIATING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED')) or
    (offer_row.status = 'NEGOTIATING' and p_next_status in ('ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED')) or
    (offer_row.status = 'EXPIRED' and p_next_status = 'DRAFT')
  ) then
    raise exception 'COMMERCIAL_OFFER_TRANSITION_INVALID';
  end if;

  if p_next_status = 'ACCEPTED'
     and offer_row.valid_until is not null
     and offer_row.valid_until < current_date then
    raise exception 'COMMERCIAL_OFFER_EXPIRED';
  end if;

  if p_next_status in ('REJECTED', 'WITHDRAWN') and normalized_reason is null then
    raise exception 'COMMERCIAL_OFFER_REASON_REQUIRED';
  end if;

  update public.offers
     set status = p_next_status,
         submitted_to_seller_at = case
           when p_next_status = 'SENT_TO_SELLER' then coalesce(submitted_to_seller_at, now())
           else submitted_to_seller_at
         end,
         accepted_at = case when p_next_status = 'ACCEPTED' then now() else accepted_at end,
         rejected_at = case when p_next_status = 'REJECTED' then now() else rejected_at end,
         withdrawn_at = case when p_next_status = 'WITHDRAWN' then now() else withdrawn_at end,
         rejection_reason = case when p_next_status = 'REJECTED' then normalized_reason else rejection_reason end,
         withdrawal_reason = case when p_next_status = 'WITHDRAWN' then normalized_reason else withdrawal_reason end,
         updated_at = now()
   where id = p_offer_id;

  insert into public.offer_status_history(
    offer_id, previous_status, next_status, reason, changed_by, metadata
  ) values (
    p_offer_id, offer_row.status, p_next_status, normalized_reason, p_actor_id,
    jsonb_build_object('source', 'crm.commercial.offer.transition')
  );

  -- A negotiation may already exist when an offer reaches a terminal state.
  -- The existing negotiation trigger then mirrors the terminal state back to the offer.
  update public.negotiations
     set status = case p_next_status
           when 'ACCEPTED' then 'ACCEPTED'
           when 'REJECTED' then 'REJECTED'
           when 'WITHDRAWN' then 'REJECTED'
           when 'EXPIRED' then 'EXPIRED'
           else status
         end,
         final_amount = case when p_next_status = 'ACCEPTED' then current_amount else final_amount end,
         concluded_at = case
           when p_next_status in ('ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED') then coalesce(concluded_at, now())
           else concluded_at
         end,
         internal_notes = case
           when p_next_status = 'WITHDRAWN' then concat_ws(E'\n', nullif(internal_notes, ''), 'Offre retirée : ' || normalized_reason)
           else internal_notes
         end,
         last_activity_at = now()
   where offer_id = p_offer_id
     and p_next_status in ('ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED');

  insert into public.activities(entity_type, entity_id, action, user_name, actor_id, metadata)
  values (
    'offer', p_offer_id,
    'Statut offre : ' || offer_row.status || ' -> ' || p_next_status,
    coalesce(nullif(btrim(p_actor_name), ''), 'Utilisateur CRM'), p_actor_id,
    jsonb_build_object(
      'previous_status', offer_row.status,
      'next_status', p_next_status,
      'reason', normalized_reason
    )
  );

  return jsonb_build_object(
    'offer_id', p_offer_id,
    'previous_status', offer_row.status,
    'status', p_next_status
  );
end;
$$;

revoke all on function public.transition_commercial_offer(uuid, text, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.transition_commercial_offer(uuid, text, text, uuid, text)
  to service_role;

-- The alert refresh is a scheduled server operation, not a client RPC.
revoke all on function public.refresh_negotiation_alerts()
  from public, anon, authenticated;
grant execute on function public.refresh_negotiation_alerts()
  to service_role;

-- Strengthen invariants already checked by the API at the database boundary.
create or replace function public.assert_commercial_offer_creation(
  p_property_id uuid,
  p_responsible_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
      from public.properties
     where id = p_property_id
       and archived_at is null
       and coalesce(commercial_status, 'AVAILABLE') not in ('SOLD')
       and coalesce(publication_status, 'DRAFT') <> 'ARCHIVED'
       and upper(coalesce(status, '')) not in ('SOLD', 'ARCHIVED', 'WITHDRAWN', 'RETIRED', 'OFF_MARKET')
  ) then
    raise exception 'COMMERCIAL_PROPERTY_NOT_FOR_SALE';
  end if;

  if not exists (
    select 1
      from public.profiles
     where id = p_responsible_user_id
       and is_active = true
       and role in ('ADMIN', 'DIRECTOR', 'AGENT')
  ) then
    raise exception 'COMMERCIAL_ASSIGNEE_INVALID';
  end if;
end;
$$;

revoke all on function public.assert_commercial_offer_creation(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.assert_commercial_offer_creation(uuid, uuid)
  to service_role;

create or replace function public.enforce_commercial_offer_creation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_commercial_offer_creation(new.property_id, new.responsible_user_id);
  return new;
end;
$$;

drop trigger if exists offers_enforce_creation_invariants on public.offers;
create trigger offers_enforce_creation_invariants
  before insert on public.offers
  for each row execute function public.enforce_commercial_offer_creation();

revoke all on function public.enforce_commercial_offer_creation()
  from public, anon, authenticated;
grant execute on function public.enforce_commercial_offer_creation()
  to service_role;
