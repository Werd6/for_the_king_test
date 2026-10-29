-- Moderation for shared notes (App Store guideline 1.2):
--   - Report a shared note. Reports go to note_reports, readable only from the
--     dashboard / SQL editor (README → Moderation has the queries).
--   - Block a member: their shared notes and photos are hidden from you.
--   - Leaders remove a member: their notes, photos and checkmarks in the huddle
--     are deleted, and they can't rejoin with the invite code.
-- Run after 004 and 011. Run in Supabase → SQL Editor. Safe to re-run.

-- -----------------------------------------------------------------------------
-- Blocks
-- -----------------------------------------------------------------------------
create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.user_blocks enable row level security;

drop policy if exists "user_blocks_select_own" on public.user_blocks;
create policy "user_blocks_select_own"
  on public.user_blocks for select
  using (blocker_id = auth.uid());

drop policy if exists "user_blocks_insert_own" on public.user_blocks;
create policy "user_blocks_insert_own"
  on public.user_blocks for insert
  with check (blocker_id = auth.uid());

drop policy if exists "user_blocks_delete_own" on public.user_blocks;
create policy "user_blocks_delete_own"
  on public.user_blocks for delete
  using (blocker_id = auth.uid());

create or replace function public.has_blocked(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_blocks b
    where b.blocker_id = auth.uid() and b.blocked_id = target
  );
$$;

revoke all on function public.has_blocked(uuid) from public, anon;
grant execute on function public.has_blocked(uuid) to authenticated;

-- Same as 004, plus: shared notes from someone you blocked are hidden.
drop policy if exists "journal_notes_select" on public.journal_notes;
create policy "journal_notes_select"
  on public.journal_notes for select
  using (
    user_id = auth.uid()
    or (visibility = 'shared' and public.is_huddle_member(huddle_id) and not public.has_blocked(user_id))
  );

drop policy if exists "journal_photos_select" on public.journal_photos;
create policy "journal_photos_select"
  on public.journal_photos for select
  using (
    exists (
      select 1 from public.journal_notes n
      where n.id = note_id
        and (
          n.user_id = auth.uid()
          or (n.visibility = 'shared' and public.is_huddle_member(n.huddle_id) and not public.has_blocked(n.user_id))
        )
    )
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
          and not public.has_blocked(n.user_id)
      )
    )
  );

-- -----------------------------------------------------------------------------
-- Reports. No client policies: written by report_note, read from the dashboard.
-- The note's text and photo paths are copied so the report survives edits.
-- -----------------------------------------------------------------------------
create table if not exists public.note_reports (
  id uuid primary key default gen_random_uuid(),
  note_id uuid references public.journal_notes (id) on delete set null,
  huddle_id uuid references public.huddles (id) on delete set null,
  reporter_id uuid references public.profiles (id) on delete set null,
  author_id uuid references public.profiles (id) on delete set null,
  reason text not null check (reason in ('abusive', 'spam', 'other')),
  details text,
  note_body text not null default '',
  photo_paths text[] not null default '{}',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution text
);

create unique index if not exists note_reports_one_open_idx
  on public.note_reports (note_id, reporter_id)
  where resolved_at is null;
create index if not exists note_reports_open_idx
  on public.note_reports (created_at)
  where resolved_at is null;

alter table public.note_reports enable row level security;

create or replace function public.report_note(p_note_id uuid, p_reason text, p_details text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  n public.journal_notes;
begin
  if v_uid is null then
    raise exception 'Not signed in.';
  end if;
  if p_reason is null or p_reason not in ('abusive', 'spam', 'other') then
    raise exception 'Choose a reason for the report.';
  end if;

  select * into n from public.journal_notes where id = p_note_id;
  if not found or n.user_id = v_uid or n.visibility <> 'shared' or not public.is_huddle_member(n.huddle_id) then
    raise exception 'This note can''t be reported.';
  end if;

  -- A second report of the same open note by the same person is ignored.
  insert into public.note_reports (note_id, huddle_id, reporter_id, author_id, reason, details, note_body, photo_paths)
  values (
    n.id,
    n.huddle_id,
    v_uid,
    n.user_id,
    p_reason,
    left(nullif(trim(coalesce(p_details, '')), ''), 1000),
    n.body,
    coalesce(
      (select array_agg(p.path order by p.created_at) from public.journal_photos p where p.note_id = n.id),
      '{}'
    )
  )
  on conflict do nothing;
end;
$$;

revoke all on function public.report_note(uuid, text, text) from public, anon;
grant execute on function public.report_note(uuid, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Leaders remove members
-- -----------------------------------------------------------------------------
create table if not exists public.huddle_removed_members (
  huddle_id uuid not null references public.huddles (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  removed_at timestamptz not null default now(),
  primary key (huddle_id, user_id)
);

alter table public.huddle_removed_members enable row level security;

-- Returns the member's photo paths so the app can delete the files (the leader
-- may delete any file in the huddle's folder).
create or replace function public.remove_huddle_member(hid uuid, uid uuid)
returns setof text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_huddle_leader(hid) then
    raise exception 'Only the leader can remove members.';
  end if;
  if uid = auth.uid() then
    raise exception 'Leaders can''t remove themselves. Dissolve the huddle instead.';
  end if;
  if not exists (select 1 from public.memberships where huddle_id = hid and user_id = uid) then
    raise exception 'That person isn''t in this huddle.';
  end if;

  insert into public.huddle_removed_members (huddle_id, user_id)
  values (hid, uid)
  on conflict do nothing;

  return query
    select p.path
    from public.journal_photos p
    join public.journal_notes n on n.id = p.note_id
    where n.huddle_id = hid and n.user_id = uid;

  delete from public.journal_notes where huddle_id = hid and user_id = uid;
  delete from public.progress where huddle_id = hid and user_id = uid;
  delete from public.memberships where huddle_id = hid and user_id = uid;
end;
$$;

revoke all on function public.remove_huddle_member(uuid, uuid) from public, anon;
grant execute on function public.remove_huddle_member(uuid, uuid) to authenticated;

-- Same as 001, plus: people the leader removed can't rejoin.
create or replace function public.join_huddle_by_code(p_code text)
returns public.huddles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_huddle public.huddles;
begin
  if v_uid is null then
    raise exception 'Not signed in.';
  end if;

  if exists (select 1 from public.memberships where user_id = v_uid) then
    raise exception 'You are already in a huddle.';
  end if;

  select * into v_huddle
  from public.huddles
  where invite_code = upper(trim(p_code));

  if not found then
    raise exception 'Invalid invite code.';
  end if;

  if exists (
    select 1 from public.huddle_removed_members r
    where r.huddle_id = v_huddle.id and r.user_id = v_uid
  ) then
    raise exception 'The leader removed you from this huddle, so you can''t rejoin it.';
  end if;

  insert into public.memberships (huddle_id, user_id)
  values (v_huddle.id, v_uid);

  return v_huddle;
end;
$$;

revoke all on function public.join_huddle_by_code(text) from public, anon;
grant execute on function public.join_huddle_by_code(text) to authenticated;
