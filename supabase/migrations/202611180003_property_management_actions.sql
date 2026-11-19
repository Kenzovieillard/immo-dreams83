begin;

alter table public.property_documents drop constraint if exists property_documents_kind_check;
alter table public.property_documents add constraint property_documents_kind_check
  check (kind in ('mandate', 'diagnostic', 'plan', 'cadastral_plan', 'ownership', 'other'));

alter table public.property_drafts add column if not exists attachments jsonb not null default '[]'::jsonb
  check (jsonb_typeof(attachments) = 'array');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('crm-property-drafts', 'crm-property-drafts', false, 4194304,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do nothing;

create or replace function public.property_publication_issues(candidate public.properties)
returns text[]
language plpgsql
stable
set search_path = ''
as $$
declare
  issues text[] := '{}';
  missing_photos integer;
begin
  if candidate.status not in ('available', 'under_offer') or candidate.archived_at is not null then
    issues := array_append(issues, 'Rendez le bien disponible ou réservé avant de le publier.');
  end if;
  if btrim(candidate.title) = '' or btrim(candidate.city) = ''
    or candidate.postal_code !~ '^[0-9]{5}$' or candidate.postal_code = '00000'
    or candidate.price <= 0 or candidate.surface <= 0 or coalesce(btrim(candidate.description_short), '') = '' then
    issues := array_append(issues, 'Renseignez le titre, la commune, le code postal, le prix, la surface et la description.');
  end if;
  select 5 - count(distinct photo) into missing_photos
  from jsonb_array_elements_text(coalesce(candidate.photos, '[]'::jsonb)) photo
  where btrim(photo) <> '';
  if missing_photos > 0 then
    issues := array_append(issues, format('Ajoutez %s photo(s) à la galerie.', missing_photos));
  end if;
  if not exists (
    select 1 from public.property_documents
    where property_id = candidate.id and archived_at is null and kind = 'ownership'
  ) then
    issues := array_append(issues, 'Joignez le titre de propriété.');
  end if;
  if not exists (
    select 1 from public.property_documents
    where property_id = candidate.id and archived_at is null and kind = 'cadastral_plan'
  ) then
    issues := array_append(issues, 'Joignez le plan cadastral.');
  end if;
  return issues;
end
$$;

create or replace function public.check_property_publication(property_key uuid)
returns text[] language sql stable set search_path = ''
as $$
  select public.property_publication_issues(p) from public.properties p where p.id = property_key;
$$;

create or replace function public.guard_property_publication()
returns trigger language plpgsql set search_path = ''
as $$
declare issues text[];
begin
  if new.publication_status <> 'PUBLISHED' then return new; end if;
  if tg_op = 'UPDATE' then
    if old.publication_status = new.publication_status then return new; end if;
  end if;
  issues := public.property_publication_issues(new);
  if cardinality(issues) > 0 then
    raise exception using errcode = '23514', message = array_to_string(issues, ' ');
  end if;
  return new;
end
$$;

drop trigger if exists guard_property_publication on public.properties;
create trigger guard_property_publication before insert or update of publication_status on public.properties
  for each row execute function public.guard_property_publication();

create or replace function public.apply_property_workspace_action(
  property_key uuid,
  expected_updated_at timestamptz,
  actor_key uuid,
  property_action text,
  action_value text default null
)
returns jsonb
language plpgsql set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  original public.properties%rowtype;
  property public.properties%rowtype;
  issues text[];
  changed jsonb;
  history_entry public.property_history%rowtype;
begin
  select * into actor from public.profiles where id = actor_key and is_active;
  if not found or actor.role not in ('ADMIN','DIRECTOR','AGENT','ASSISTANT','MARKETING')
    or (property_action = 'delete' and actor.role not in ('ADMIN','DIRECTOR')) then
    return jsonb_build_object('error', 'forbidden');
  end if;

  select * into original from public.properties where id = property_key for update;
  if not found then return jsonb_build_object('error', 'missing'); end if;
  if actor.role = 'AGENT' and coalesce(original.advisor_id, original.created_by) is distinct from actor_key then
    return jsonb_build_object('error', 'forbidden');
  end if;
  if original.updated_at is distinct from expected_updated_at then
    return jsonb_build_object('error', 'conflict');
  end if;

  if property_action = 'delete' then
    -- Keep independent CRM records and documents with an existing retention relationship.
    if exists (select 1 from public.property_documents where property_id = property_key)
      or exists (select 1 from public.property_drafts where id = property_key)
      or exists (select 1 from public.leads where linked_property_id = property_key)
      or exists (select 1 from public.estimations where converted_property_id = property_key)
      or exists (select 1 from public.mandates where property_id = property_key)
      or exists (select 1 from public.appointments where property_id = property_key)
      or exists (select 1 from public.offers where property_id = property_key)
      or exists (select 1 from public.negotiations where property_id = property_key)
      or exists (select 1 from public.tasks where property_id = property_key)
      or exists (select 1 from public.match_suggestions where property_id = property_key) then
      return jsonb_build_object('error', 'linked');
    end if;
    delete from public.properties where id = property_key;
    delete from public.activities where entity_type = 'property' and entity_id = property_key::text;
    insert into public.audit_logs(actor_id, actor_email, actor_role, action, entity_type, entity_id, metadata)
    values (actor.id, actor.email, actor.role, 'property.delete', 'property', property_key::text,
      jsonb_build_object('reference', original.reference));
    return jsonb_build_object('deleted', true);
  end if;

  property := original;
  case property_action
    when 'availability' then
      if action_value is null or action_value not in ('available','under_offer','sold') or original.archived_at is not null
        then return jsonb_build_object('error', 'invalid_state'); end if;
      property.status := action_value;
      property.commercial_status := case action_value
        when 'available' then 'AVAILABLE' when 'under_offer' then 'UNDER_OFFER' else 'SOLD' end;
    when 'feature' then
      if action_value is null or action_value not in ('true','false') then return jsonb_build_object('error', 'invalid_state'); end if;
      if action_value = 'true' and (original.publication_status <> 'PUBLISHED' or original.status = 'sold' or original.archived_at is not null)
        then return jsonb_build_object('error', 'not_public'); end if;
      property.featured := action_value::boolean;
    when 'archive' then
      property.publication_status := 'ARCHIVED';
      property.archived_at := coalesce(original.archived_at, now());
      property.archived_by := coalesce(original.archived_by, actor_key);
      property.unpublished_at := coalesce(original.unpublished_at, now());
      property.featured := false;
      property.scheduled_publication_at := null;
      property.publication_scheduled_by := null;
      property.publication_schedule_error := null;
    when 'restore' then
      if original.publication_status <> 'ARCHIVED' then return jsonb_build_object('error', 'invalid_state'); end if;
      property.publication_status := 'DRAFT';
      property.archived_at := null;
      property.archived_by := null;
      property.featured := false;
    when 'publish' then
      issues := public.property_publication_issues(original);
      if cardinality(issues) > 0 then return jsonb_build_object('error', 'incomplete', 'message', array_to_string(issues, ' ')); end if;
      property.publication_status := 'PUBLISHED';
      property.published_at := coalesce(original.published_at, now());
      property.unpublished_at := null;
      property.scheduled_publication_at := null;
      property.publication_scheduled_by := null;
      property.publication_schedule_error := null;
    when 'unpublish' then
      if original.publication_status <> 'PUBLISHED' then return jsonb_build_object('error', 'invalid_state'); end if;
      property.publication_status := 'UNPUBLISHED';
      property.unpublished_at := now();
      property.featured := false;
    else
      return jsonb_build_object('error', 'invalid_state');
  end case;

  if property is distinct from original then
    update public.properties set
      status = property.status, commercial_status = property.commercial_status,
      publication_status = property.publication_status, featured = property.featured,
      archived_at = property.archived_at, archived_by = property.archived_by,
      published_at = property.published_at, unpublished_at = property.unpublished_at,
      scheduled_publication_at = property.scheduled_publication_at,
      publication_scheduled_by = property.publication_scheduled_by,
      publication_schedule_error = property.publication_schedule_error,
      updated_by = actor_key, updated_at = now()
    where id = property_key returning * into property;

    select coalesce(jsonb_agg(entry.key order by entry.key), '[]'::jsonb) into changed
    from jsonb_each(to_jsonb(property)) entry
    where entry.key not in ('updated_at','updated_by')
      and to_jsonb(original)->entry.key is distinct from entry.value;

    insert into public.property_versions (property_id, reference, snapshot, changed_by, change_reason)
    values (property_key, original.reference, to_jsonb(original), actor_key, 'property.' || property_action);
    insert into public.property_history (property_id, reference, action, changed_fields, previous_value, next_value, actor_id, actor_email)
    values (property_key, original.reference, 'property.' || property_action, changed, to_jsonb(original), to_jsonb(property), actor_key, actor.email)
    returning * into history_entry;
    insert into public.audit_logs (actor_id, actor_email, actor_role, action, entity_type, entity_id, metadata)
    values (actor_key, actor.email, actor.role, 'property.' || property_action, 'property', property_key::text,
      jsonb_build_object('reference', original.reference, 'changedFields', changed));
  end if;

  return jsonb_build_object(
    'status', property.status, 'commercialStatus', property.commercial_status,
    'publicationStatus', property.publication_status, 'featured', property.featured,
    'archivedAt', property.archived_at, 'publishedAt', property.published_at, 'unpublishedAt', property.unpublished_at,
    'scheduledPublicationAt', property.scheduled_publication_at, 'publicationScheduleError', property.publication_schedule_error,
    'updatedAt', property.updated_at,
    'historyEvent', case when history_entry.id is not null then jsonb_build_object(
      'id', history_entry.id, 'action', history_entry.action, 'changedFields', history_entry.changed_fields,
      'previousValue', history_entry.previous_value, 'nextValue', history_entry.next_value,
      'actorEmail', history_entry.actor_email, 'createdAt', history_entry.created_at
    ) end
  );
end
$$;

revoke execute on function public.property_publication_issues(public.properties) from public, anon, authenticated;
revoke execute on function public.guard_property_publication() from public, anon, authenticated;
revoke execute on function public.check_property_publication(uuid) from public, anon, authenticated;
revoke execute on function public.apply_property_workspace_action(uuid, timestamptz, uuid, text, text) from public, anon, authenticated;
grant execute on function public.property_publication_issues(public.properties) to service_role;
grant execute on function public.check_property_publication(uuid) to service_role;
grant execute on function public.apply_property_workspace_action(uuid, timestamptz, uuid, text, text) to service_role;


create or replace function public.run_scheduled_property_publications()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  candidate public.properties%rowtype;
  actor public.profiles%rowtype;
  failure text;
  published integer := 0;
begin
  for candidate in
    select * from public.properties
    where scheduled_publication_at <= now()
    order by scheduled_publication_at, id
    limit 100 for update skip locked
  loop
    select * into actor from public.profiles where id = candidate.publication_scheduled_by;
    failure := case
      when not found or not actor.is_active or actor.role not in ('ADMIN', 'DIRECTOR', 'AGENT', 'ASSISTANT', 'MARKETING')
        then 'Le profil qui a programmé la publication ne peut plus publier.'
      when candidate.publication_status not in ('DRAFT', 'UNPUBLISHED') or candidate.archived_at is not null
        or candidate.status not in ('available', 'under_offer')
        then 'Le statut du bien a changé depuis la programmation.'
      else nullif(array_to_string(public.property_publication_issues(candidate), ' '), '')
    end;

    update public.properties set
      scheduled_publication_at = null,
      publication_scheduled_by = null,
      publication_schedule_error = failure,
      publication_status = case when failure is null then 'PUBLISHED' else candidate.publication_status end,
      published_at = case when failure is null then now() else candidate.published_at end,
      unpublished_at = case when failure is null then null else candidate.unpublished_at end,
      updated_by = case when failure is null then actor.id else candidate.updated_by end
    where id = candidate.id;

    insert into public.property_history (property_id, reference, action, changed_fields, actor_id, actor_email, next_value)
    values (
      candidate.id, candidate.reference,
      case when failure is null then 'property.publication.scheduled' else 'property.publication.blocked' end,
      '["publication_status", "scheduled_publication_at"]', actor.id, actor.email,
      jsonb_build_object('scheduled_for', candidate.scheduled_publication_at, 'error', failure)
    );
    if failure is null then published := published + 1; end if;
  end loop;
  return published;
end
$$;

revoke execute on function public.run_scheduled_property_publications() from public, anon, authenticated, service_role;

commit;
