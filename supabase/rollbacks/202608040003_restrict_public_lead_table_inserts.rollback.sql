-- Safe rollback for 202608040003.
-- Reopens the previous anon insert policies if public API routes cannot persist.

begin;

drop policy if exists "Public can submit contacts" on public.contacts;
create policy "Public can submit contacts"
  on public.contacts for insert to anon
  with check (status = 'NEW' and archived = false);

drop policy if exists "Public can submit estimations" on public.estimations;
create policy "Public can submit estimations"
  on public.estimations for insert to anon
  with check (status = 'NEW' and archived = false);

comment on table public.contacts is
  'Rollback state: direct anon inserts are allowed when status = NEW and archived = false.';

comment on table public.estimations is
  'Rollback state: direct anon inserts are allowed when status = NEW and archived = false.';

commit;
