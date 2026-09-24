-- =============================================================================
-- For The King — Supabase schema (framework + cloud content library)
-- Paste into: Supabase Dashboard → SQL Editor → Run
-- =============================================================================
-- Design:
--   • App is a renderer/framework (auth, huddles, checkmarks, leader tools)
--   • Pathways/weeks live in the cloud so you can publish content without
--     App Store rebuilds
--   • Each huddle pins a specific pathway_version so mid-track groups stay stable
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Profiles
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  email text,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Content library: pathways (catalog) + immutable versions + weeks
-- -----------------------------------------------------------------------------

-- Logical pathway (e.g. "FOR THE KING"). Many versions over time.
create table if not exists public.pathways (
  id text primary key,                          -- e.g. 'for-the-king'
  name text not null,
  description text not null default '',
  is_published boolean not null default false,  -- visible in Create Huddle picker
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Immutable snapshot of a pathway. Publish = insert a new version, don't rewrite.
create table if not exists public.pathway_versions (
  id uuid primary key default gen_random_uuid(),
  pathway_id text not null references public.pathways (id) on delete cascade,
  version int not null,                         -- 1, 2, 3…
  label text,                                   -- optional 'v1', 'Fall 2026'
  total_weeks int not null check (total_weeks > 0),
  -- Optional extras for this version (leader guide, challenge pool, movements)
  leader_guide jsonb not null default '{}'::jsonb,
  challenge_pool jsonb not null default '{}'::jsonb,
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (pathway_id, version)
);

create index if not exists pathway_versions_pathway_id_idx
  on public.pathway_versions (pathway_id);

-- One row per week. `content` matches the app JSON shape for that week type.
-- standard: intro, reading, discuss, talkingToGod, journaling[], challenges[], careForTheBody
-- groupChallenge: intro, options[], beforeYouGo[], closeInPrayer, celebrate, guardrails
create table if not exists public.pathway_weeks (
  id uuid primary key default gen_random_uuid(),
  pathway_version_id uuid not null references public.pathway_versions (id) on delete cascade,
  week_number int not null check (week_number > 0),
  title text not null,
  movement text,                                -- e.g. 'Abide', 'Be Known'
  week_type text not null check (week_type in ('standard', 'groupChallenge')),
  content jsonb not null,
  created_at timestamptz not null default now(),
  unique (pathway_version_id, week_number)
);

create index if not exists pathway_weeks_version_idx
  on public.pathway_weeks (pathway_version_id);

-- Convenience: latest published version per pathway (for Create Huddle picker)
create or replace view public.pathways_available as
select
  p.id as pathway_id,
  p.name,
  p.description,
  p.sort_order,
  pv.id as pathway_version_id,
  pv.version,
  pv.total_weeks,
  pv.published_at
from public.pathways p
join lateral (
  select *
  from public.pathway_versions v
  where v.pathway_id = p.id
    and v.is_published = true
  order by v.version desc
  limit 1
) pv on true
where p.is_published = true
order by p.sort_order, p.name;

-- -----------------------------------------------------------------------------
-- Huddles / membership / progress
-- -----------------------------------------------------------------------------

create table if not exists public.huddles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  leader_id uuid not null references public.profiles (id),
  -- Pin the exact published snapshot so content edits don't move mid-huddle
  pathway_id text not null references public.pathways (id),
  pathway_version_id uuid not null references public.pathway_versions (id),
  current_week int not null default 1 check (current_week >= 1),
  meetings jsonb not null default '{"time":null,"location":null}'::jsonb,  -- { time: ISO|null, location: string|null }
  created_at timestamptz not null default now()
);

create index if not exists huddles_invite_code_idx on public.huddles (invite_code);
create index if not exists huddles_pathway_version_idx on public.huddles (pathway_version_id);

-- One active huddle per user
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  huddle_id uuid not null references public.huddles (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists memberships_huddle_id_idx on public.memberships (huddle_id);

-- Checkmarks only (no journal / prayer text)
create table if not exists public.progress (
  id uuid primary key default gen_random_uuid(),
  huddle_id uuid not null references public.huddles (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  week int not null check (week >= 1),
  item_id text not null,                        -- stable ids e.g. w01-c3, w01-j2, w01-body
  completed_at timestamptz not null default now(),
  unique (huddle_id, user_id, week, item_id)
);

create index if not exists progress_huddle_week_idx on public.progress (huddle_id, week);

-- Leader pick for group-challenge weeks
create table if not exists public.huddle_week_picks (
  huddle_id uuid not null references public.huddles (id) on delete cascade,
  week int not null check (week >= 1),
  option_id text not null,
  picked_by uuid not null references public.profiles (id),
  picked_at timestamptz not null default now(),
  primary key (huddle_id, week)
);

-- -----------------------------------------------------------------------------
-- Auth: auto-create profile
-- -----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'Brother'),
    new.email
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep pathways.updated_at fresh
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pathways_set_updated_at on public.pathways;
create trigger pathways_set_updated_at
  before update on public.pathways
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS helpers
-- -----------------------------------------------------------------------------

create or replace function public.is_huddle_member(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.huddle_id = hid and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_huddle_leader(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.huddles h
    where h.id = hid and h.leader_id = auth.uid()
  );
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.pathways enable row level security;
alter table public.pathway_versions enable row level security;
alter table public.pathway_weeks enable row level security;
alter table public.huddles enable row level security;
alter table public.memberships enable row level security;
alter table public.progress enable row level security;
alter table public.huddle_week_picks enable row level security;

-- Profiles
create policy "profiles_select_same_huddle"
  on public.profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.memberships me
      join public.memberships them on them.huddle_id = me.huddle_id
      where me.user_id = auth.uid() and them.user_id = profiles.id
    )
  );

create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid());

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (id = auth.uid());

-- Content library: any signed-in user can READ published pathways/versions/weeks
-- Writes are via service role (Dashboard / admin script / Edge Function) — no client insert policies
create policy "pathways_select_published"
  on public.pathways for select
  to authenticated
  using (is_published = true);

create policy "pathway_versions_select_published"
  on public.pathway_versions for select
  to authenticated
  using (
    is_published = true
    or exists (
      -- Members can still read the pinned version even if you unpublish later
      select 1 from public.huddles h
      join public.memberships m on m.huddle_id = h.id
      where h.pathway_version_id = pathway_versions.id
        and m.user_id = auth.uid()
    )
  );

create policy "pathway_weeks_select_readable_version"
  on public.pathway_weeks for select
  to authenticated
  using (
    exists (
      select 1 from public.pathway_versions v
      where v.id = pathway_weeks.pathway_version_id
        and (
          v.is_published = true
          or exists (
            select 1 from public.huddles h
            join public.memberships m on m.huddle_id = h.id
            where h.pathway_version_id = v.id
              and m.user_id = auth.uid()
          )
        )
    )
  );

-- Huddles
create policy "huddles_select_member"
  on public.huddles for select
  using (public.is_huddle_member(id) or leader_id = auth.uid());

create policy "huddles_select_by_invite_for_join"
  on public.huddles for select
  using (auth.uid() is not null);

create policy "huddles_insert_leader"
  on public.huddles for insert
  with check (leader_id = auth.uid());

create policy "huddles_update_leader"
  on public.huddles for update
  using (leader_id = auth.uid());

create policy "huddles_delete_leader"
  on public.huddles for delete
  using (leader_id = auth.uid());

-- Memberships
create policy "memberships_select_same_huddle"
  on public.memberships for select
  using (public.is_huddle_member(huddle_id) or user_id = auth.uid());

create policy "memberships_insert_self"
  on public.memberships for insert
  with check (user_id = auth.uid());

create policy "memberships_delete_self_or_leader"
  on public.memberships for delete
  using (user_id = auth.uid() or public.is_huddle_leader(huddle_id));

-- Progress
create policy "progress_select_same_huddle"
  on public.progress for select
  using (public.is_huddle_member(huddle_id));

create policy "progress_insert_own"
  on public.progress for insert
  with check (user_id = auth.uid() and public.is_huddle_member(huddle_id));

create policy "progress_delete_own"
  on public.progress for delete
  using (user_id = auth.uid());

-- Week picks
create policy "picks_select_member"
  on public.huddle_week_picks for select
  using (public.is_huddle_member(huddle_id));

create policy "picks_insert_leader"
  on public.huddle_week_picks for insert
  with check (public.is_huddle_leader(huddle_id) and picked_by = auth.uid());

create policy "picks_update_leader"
  on public.huddle_week_picks for update
  using (public.is_huddle_leader(huddle_id));

-- =============================================================================
-- Seed: FOR THE KING pathway shell (weeks uploaded separately as JSON)
-- After running this, insert pathway_weeks rows from content/pathway.json
-- (or run a publish script). Example week insert is at the bottom.
-- =============================================================================

insert into public.pathways (id, name, description, is_published, sort_order)
values (
  'for-the-king',
  'FOR THE KING',
  'A 20-week men’s discipleship huddle pathway.',
  true,
  1
)
on conflict (id) do update
set name = excluded.name,
    description = excluded.description,
    is_published = excluded.is_published,
    sort_order = excluded.sort_order;

-- Create version 1 shell (mark published after weeks are loaded)
insert into public.pathway_versions (
  pathway_id, version, label, total_weeks, is_published, published_at
)
values (
  'for-the-king', 1, 'v1', 20, false, null
)
on conflict (pathway_id, version) do nothing;

-- Example: one standard week (replace / expand via your publish script)
-- Uncomment and adjust pathway_version_id after selecting it:
--
-- insert into public.pathway_weeks (
--   pathway_version_id, week_number, title, movement, week_type, content
-- ) values (
--   '<pathway_version_uuid>',
--   1,
--   'Remain in the Vine',
--   'Abide',
--   'standard',
--   '{
--     "intro": "…",
--     "reading": "John 15:1–11",
--     "discuss": ["…"],
--     "talkingToGod": ["…"],
--     "journaling": [{"id":"w01-j1","text":"…"}],
--     "challenges": [{"id":"w01-c1","text":"…"}],
--     "careForTheBody": {"id":"w01-body","text":"…"}
--   }'::jsonb
-- );

-- After all 20 weeks are inserted:
-- update public.pathway_versions
-- set is_published = true, published_at = now()
-- where pathway_id = 'for-the-king' and version = 1;

-- =============================================================================
-- Publishing workflow (you / admin, using service role — not the app anon key)
-- =============================================================================
-- 1. insert pathway (if new)
-- 2. insert pathway_versions with is_published = false
-- 3. insert all pathway_weeks for that version
-- 4. set is_published = true on the version (and pathway)
-- 5. Create Huddle stores pathway_id + pathway_version_id from pathways_available
-- 6. Never edit weeks of a published version in place — bump version instead
-- =============================================================================
