-- Journal photo uploads: only needed if you ran the old
-- 009_no_journal_photo_uploads.sql, which removed these two policies.
-- Same policies as 004_journaling.sql. Safe to run more than once.

drop policy if exists "journal_photos_insert_own" on public.journal_photos;
create policy "journal_photos_insert_own"
  on public.journal_photos for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.journal_notes n where n.id = note_id and n.user_id = auth.uid())
  );

drop policy if exists "journal_objects_insert_own" on storage.objects;
create policy "journal_objects_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'journal'
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.is_huddle_member(((storage.foldername(name))[1])::uuid)
  );
