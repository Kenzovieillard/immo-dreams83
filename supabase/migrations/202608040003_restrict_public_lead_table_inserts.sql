-- Restrict direct anonymous inserts into lead intake tables.
-- Public submissions must go through the Next.js API routes, which validate
-- payloads server-side and persist with the service role key.

drop policy if exists "Public can submit contacts" on public.contacts;
drop policy if exists "Public can submit estimations" on public.estimations;

comment on table public.contacts is
  'Public contact submissions are accepted through /api/contact. Direct anon inserts are intentionally denied by RLS.';

comment on table public.estimations is
  'Public estimation submissions are accepted through /api/estimation. Direct anon inserts are intentionally denied by RLS.';
