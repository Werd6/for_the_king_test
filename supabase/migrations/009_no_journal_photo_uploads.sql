-- Journal notes are text only. Stop new photo uploads; existing photos can
-- still be read and deleted, so account deletion and dissolving a huddle
-- still remove them. Run in Supabase → SQL Editor. Safe to run more than once.

drop policy if exists "journal_photos_insert_own" on public.journal_photos;
drop policy if exists "journal_objects_insert_own" on storage.objects;
