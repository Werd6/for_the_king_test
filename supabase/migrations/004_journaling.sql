-- =============================================================================
-- On-platform journaling: notes (text + photos) on journaling items, with
-- per-huddle leader settings. Safe to re-run.
-- Paste into: Supabase Dashboard → SQL Editor → Run
-- =============================================================================

-- Leader settings. Defaults keep existing huddles unchanged.
alter table public.huddles
  add column if not exists settings jsonb not null
  default '{"requireNotes":false,"notesVisibility":"private"}'::jsonb;

create table if not exists public.journal_notes (
  id uuid primary key default gen_random_uuid(),
  huddle_id uuid not null references public.huddles (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  week int not null check (week >= 1),
  item_id text not null,
  body text not null default '',
  -- Snapshot of the huddle's notesVisibility when the note was last saved.
  visibility text not null default 'private' check (visibility in ('private', 'shared')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (huddle_id, user_id, week, item_id)
);

create index if not exists journal_notes_huddle_week_idx on public.journal_notes (huddle_id, week);

create table if not exists public.journal_photos (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.journal_notes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  path text not null unique,  -- storage path in the `journal` bucket
  created_at timestamptz not null default now()
);

create index if not exists journal_photos_note_idx on public.journal_photos (note_id);

-- Visibility always comes from the huddle setting, never from the client.
create or replace function public.journal_note_apply_visibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select case when h.settings->>'notesVisibility' = 'shared' then 'shared' else 'private' end
    into new.visibility
  from public.huddles h
  where h.id = new.huddle_id;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists journal_notes_visibility on public.journal_notes;
create trigger journal_notes_visibility
  before insert or update on public.journal_notes
  for each row execute function public.journal_note_apply_visibility();

-- Access rules
alter table public.journal_notes enable row level security;
alter table public.journal_photos enable row level security;

drop policy if exists "journal_notes_select" on public.journal_notes;
create policy "journal_notes_select"
  on public.journal_notes for select
  using (
    user_id = auth.uid()
    or (visibility = 'shared' and public.is_huddle_member(huddle_id))
  );

drop policy if exists "journal_notes_insert_own" on public.journal_notes;
create policy "journal_notes_insert_own"
  on public.journal_notes for insert
  with check (user_id = auth.uid() and public.is_huddle_member(huddle_id));

drop policy if exists "journal_notes_update_own" on public.journal_notes;
create policy "journal_notes_update_own"
  on public.journal_notes for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_huddle_member(huddle_id));

drop policy if exists "journal_notes_delete_own" on public.journal_notes;
create policy "journal_notes_delete_own"
  on public.journal_notes for delete
  using (user_id = auth.uid());

drop policy if exists "journal_photos_select" on public.journal_photos;
create policy "journal_photos_select"
  on public.journal_photos for select
  using (
    exists (
      select 1 from public.journal_notes n
      where n.id = note_id
        and (n.user_id = auth.uid() or (n.visibility = 'shared' and public.is_huddle_member(n.huddle_id)))
    )
  );

drop policy if exists "journal_photos_insert_own" on public.journal_photos;
create policy "journal_photos_insert_own"
  on public.journal_photos for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.journal_notes n where n.id = note_id and n.user_id = auth.uid())
  );

drop policy if exists "journal_photos_delete_own" on public.journal_photos;
create policy "journal_photos_delete_own"
  on public.journal_photos for delete
  using (user_id = auth.uid());

-- Photo storage: private bucket, paths `{huddle_id}/{user_id}/{note_id}/{file}`.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('journal', 'journal', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "journal_objects_insert_own" on storage.objects;
create policy "journal_objects_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'journal'
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.is_huddle_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "journal_objects_select" on storage.objects;
create policy "journal_objects_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'journal'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or exists (
        select 1
        from public.journal_photos p
        join public.journal_notes n on n.id = p.note_id
        where p.path = storage.objects.name
          and n.visibility = 'shared'
          and public.is_huddle_member(n.huddle_id)
      )
    )
  );

-- Owners delete their own files; the leader can delete a huddle's files when dissolving it.
drop policy if exists "journal_objects_delete" on storage.objects;
create policy "journal_objects_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'journal'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or public.is_huddle_leader(((storage.foldername(name))[1])::uuid)
    )
  );

-- Paths only (no content) so a leader can remove every file before dissolving.
create or replace function public.journal_photo_paths_for_huddle(hid uuid)
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select p.path
  from public.journal_photos p
  join public.journal_notes n on n.id = p.note_id
  where n.huddle_id = hid and public.is_huddle_leader(hid);
$$;

revoke all on function public.journal_photo_paths_for_huddle(uuid) from public, anon;
grant execute on function public.journal_photo_paths_for_huddle(uuid) to authenticated;

-- When the huddle requires notes, a tagged item can't be checked off without one.
create or replace function public.progress_require_note()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_require boolean;
  v_version uuid;
begin
  select coalesce((h.settings->>'requireNotes')::boolean, false), h.pathway_version_id
    into v_require, v_version
  from public.huddles h
  where h.id = new.huddle_id;

  if not coalesce(v_require, false) then
    return new;
  end if;

  if not exists (
    select 1 from public.pathway_weeks pw
    where pw.pathway_version_id = v_version
      and pw.week_number = new.week
      and jsonb_path_exists(
        pw.content,
        '$.** ? (@.id == $id && @.requiresNote == true)',
        jsonb_build_object('id', new.item_id)
      )
  ) then
    return new;
  end if;

  if exists (
    select 1 from public.journal_notes n
    where n.huddle_id = new.huddle_id
      and n.user_id = new.user_id
      and n.week = new.week
      and n.item_id = new.item_id
      and (
        char_length(regexp_replace(n.body, '\s', '', 'g')) >= 10
        or exists (select 1 from public.journal_photos p where p.note_id = n.id)
      )
  ) then
    return new;
  end if;

  raise exception 'NOTE_REQUIRED: Add your notes before checking this off.';
end;
$$;

drop trigger if exists progress_require_note on public.progress;
create trigger progress_require_note
  before insert on public.progress
  for each row execute function public.progress_require_note();
