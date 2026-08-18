-- Restrict anonymous listing of the public property photos bucket.
-- Public object URLs remain served by the public bucket setting; direct Storage
-- listing through the anon role is intentionally denied.

drop policy if exists "Public can read property photos" on storage.objects;
