-- IMMO-DREAMS83 V3 phase 2
-- Supabase becomes the single source of truth for public properties.
-- Non destructive: existing columns and legacy photos JSON are kept.

create extension if not exists pgcrypto;

alter table properties add column if not exists commercial_status text;
alter table properties add column if not exists publication_status text not null default 'DRAFT';
alter table properties add column if not exists published_at timestamptz;
alter table properties add column if not exists unpublished_at timestamptz;
alter table properties add column if not exists archived_at timestamptz;
alter table properties add column if not exists archived_by uuid references profiles(id) on delete set null;
alter table properties add column if not exists created_by uuid references profiles(id) on delete set null;
alter table properties add column if not exists updated_by uuid references profiles(id) on delete set null;

update properties
set commercial_status = case
  when status = 'under_offer' then 'UNDER_OFFER'
  when status = 'sold' then 'SOLD'
  else 'AVAILABLE'
end
where commercial_status is null;

update properties
set publication_status = case
  when status = 'sold' then 'UNPUBLISHED'
  else 'PUBLISHED'
end
where publication_status is null
   or publication_status not in ('DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED');

update properties
set published_at = coalesce(published_at, created_at)
where publication_status = 'PUBLISHED'
  and published_at is null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'properties_commercial_status_check') then
    alter table properties
      add constraint properties_commercial_status_check
      check (commercial_status in ('AVAILABLE', 'UNDER_OFFER', 'SOLD'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'properties_publication_status_check') then
    alter table properties
      add constraint properties_publication_status_check
      check (publication_status in ('DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED'));
  end if;
end
$$;

create table if not exists property_photos (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  storage_bucket text not null default 'property-photos',
  storage_path text not null,
  public_url text not null,
  alt_text text,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  status text not null default 'ACTIVE',
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  trashed_at timestamptz,
  trashed_by uuid references profiles(id) on delete set null,
  restore_until timestamptz,
  restored_at timestamptz,
  purged_at timestamptz
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'property_photos_status_check') then
    alter table property_photos
      add constraint property_photos_status_check
      check (status in ('ACTIVE', 'TRASHED', 'PURGED'));
  end if;
end
$$;

create unique index if not exists property_photos_property_url_key
  on property_photos(property_id, public_url);
create unique index if not exists property_photos_primary_active_key
  on property_photos(property_id)
  where is_primary = true and status = 'ACTIVE';
create index if not exists property_photos_property_sort_idx
  on property_photos(property_id, status, sort_order);
create index if not exists property_photos_trash_idx
  on property_photos(status, trashed_at desc);

insert into property_photos (
  property_id,
  storage_bucket,
  storage_path,
  public_url,
  alt_text,
  sort_order,
  is_primary,
  status
)
select
  p.id,
  case
    when photo_url like '%/storage/v1/object/public/property-photos/%' then 'property-photos'
    else 'external'
  end,
  case
    when photo_url like '%/storage/v1/object/public/property-photos/%'
      then split_part(photo_url, '/storage/v1/object/public/property-photos/', 2)
    else 'external/' || md5(photo_url)
  end,
  photo_url,
  p.title || ' - photo ' || photo_ordinality,
  photo_ordinality - 1,
  photo_ordinality = 1,
  'ACTIVE'
from properties p
cross join lateral jsonb_array_elements_text(coalesce(p.photos, '[]'::jsonb))
  with ordinality as photo_items(photo_url, photo_ordinality)
on conflict (property_id, public_url) do update
set
  alt_text = excluded.alt_text,
  sort_order = excluded.sort_order,
  is_primary = excluded.is_primary,
  status = 'ACTIVE',
  restored_at = null,
  purged_at = null;

create table if not exists property_history (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties(id) on delete cascade,
  reference text not null,
  action text not null,
  changed_fields jsonb not null default '[]'::jsonb,
  previous_value jsonb,
  next_value jsonb,
  actor_id uuid references profiles(id) on delete set null,
  actor_email text,
  created_at timestamptz not null default now()
);

create index if not exists property_history_property_created_idx
  on property_history(property_id, created_at desc);
create index if not exists property_history_reference_idx
  on property_history(reference, created_at desc);

create table if not exists property_slug_history (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties(id) on delete cascade,
  old_slug text not null unique,
  new_slug text not null,
  reason text not null default 'legacy_redirect',
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

insert into property_slug_history (property_id, old_slug, new_slug, reason)
select id, 'appartement-t2-lumineux-toulon', slug, 'legacy_static_slug'
from properties
where slug = 'appartement-toulon-83000-ref-72'
on conflict (old_slug) do nothing;

drop view if exists public_property_slug_redirects;
drop view if exists public_properties;

create view public_properties as
select
  p.id,
  p.reference,
  p.mandate_number,
  p.slug,
  p.title,
  p.type,
  p.transaction_type,
  p.status,
  p.commercial_status,
  p.publication_status,
  p.city,
  p.postal_code,
  p.price,
  p.fees_included,
  p.surface,
  p.land_surface,
  p.rooms,
  p.bedrooms,
  p.bathrooms,
  p.energy_class,
  p.climate_class,
  p.description_short,
  p.description_long,
  p.features,
  coalesce(
    jsonb_agg(pp.public_url order by pp.sort_order)
      filter (where pp.id is not null and pp.status = 'ACTIVE'),
    p.photos,
    '[]'::jsonb
  ) as photos,
  p.featured,
  p.created_at,
  p.updated_at,
  p.published_at,
  p.archived_at
from properties p
left join property_photos pp
  on pp.property_id = p.id
 and pp.status = 'ACTIVE'
where p.publication_status = 'PUBLISHED'
  and p.archived_at is null
  and p.status in ('available', 'under_offer')
group by p.id;

create view public_property_slug_redirects as
select
  h.old_slug,
  h.new_slug
from property_slug_history h
join properties p on p.id = h.property_id
where p.publication_status = 'PUBLISHED'
  and p.archived_at is null
  and p.status in ('available', 'under_offer');

drop policy if exists "Public can read available properties" on properties;
revoke select on properties from anon;
grant select on public_properties to anon, authenticated;
grant select on public_property_slug_redirects to anon, authenticated;

alter table property_photos enable row level security;
alter table property_history enable row level security;
alter table property_slug_history enable row level security;

drop policy if exists "Active admins can read property photos" on property_photos;
create policy "Active admins can read property photos"
  on property_photos for select to authenticated
  using (public.is_active_admin());

drop policy if exists "Active admins can read property history" on property_history;
create policy "Active admins can read property history"
  on property_history for select to authenticated
  using (public.is_active_admin());

drop policy if exists "Active admins can read slug history" on property_slug_history;
create policy "Active admins can read slug history"
  on property_slug_history for select to authenticated
  using (public.is_active_admin());

create index if not exists properties_public_visibility_idx
  on properties(publication_status, archived_at, status, featured, updated_at desc);
create index if not exists properties_commercial_status_idx
  on properties(commercial_status);
