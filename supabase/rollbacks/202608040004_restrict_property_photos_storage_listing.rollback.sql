-- Safe rollback for 202608040004.
-- Reopens anonymous Storage listing/SELECT for the public property photos bucket.

begin;

drop policy if exists "Public can read property photos" on storage.objects;
create policy "Public can read property photos"
  on storage.objects for select to anon
  using (bucket_id = 'property-photos');

commit;
