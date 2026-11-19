begin;

create extension if not exists pg_cron with schema pg_catalog;

alter table public.properties
  add column if not exists scheduled_publication_at timestamptz,
  add column if not exists publication_scheduled_by uuid references public.profiles(id) on delete set null,
  add column if not exists publication_schedule_error text;

create index if not exists properties_publication_due_idx
  on public.properties(scheduled_publication_at)
  where scheduled_publication_at is not null;

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
      when btrim(candidate.title) = '' or btrim(candidate.city) = '' or candidate.postal_code !~ '^[0-9]{5}$'
        or candidate.price <= 0 or candidate.surface <= 0 or coalesce(btrim(candidate.description_short), '') = ''
        then 'Le titre, la commune, le code postal, le prix, la surface et la description doivent être renseignés.'
      else null
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

select cron.schedule(
  'publish-immodreams-properties',
  '* * * * *',
  $job$ select public.run_scheduled_property_publications(); $job$
);

commit;
