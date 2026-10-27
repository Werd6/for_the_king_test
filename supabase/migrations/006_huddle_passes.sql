-- =============================================================================
-- Huddle Pass: one-time passes bought on the website through Stripe.
-- Leader Pass = $1 x pathway weeks, Member Pass = $0.50 x pathway weeks.
-- Access lasts ceil(weeks x 1.2) weeks from when the leader starts Week 1;
-- after that the huddle is read-only. Huddles that exist when this first runs
-- stay free (billing_exempt).
-- Run after 004_journaling.sql. Paste into: Supabase Dashboard → SQL Editor → Run.
-- Safe to re-run.
-- =============================================================================

alter table public.huddles
  add column if not exists started_at timestamptz,
  add column if not exists access_weeks int check (access_weeks is null or access_weeks > 0);

-- Grandfather existing huddles only the first time, so re-running never frees paid ones.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'huddles' and column_name = 'billing_exempt'
  ) then
    alter table public.huddles add column billing_exempt boolean not null default false;
    update public.huddles set billing_exempt = true;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Passes. Written only by the Stripe webhook (service role) or the SQL editor.
-- Rows outlive dissolved huddles and deleted accounts as payment records.
-- -----------------------------------------------------------------------------
create table if not exists public.huddle_passes (
  id uuid primary key default gen_random_uuid(),
  huddle_id uuid references public.huddles (id) on delete set null,
  user_id uuid references public.profiles (id) on delete set null,
  kind text not null check (kind in ('leader', 'member')),
  amount_cents int not null default 0 check (amount_cents >= 0),
  source text not null check (source in ('stripe', 'comp')),
  stripe_session_id text unique,
  stripe_payment_intent text,
  created_at timestamptz not null default now(),
  refunded_at timestamptz
);

create unique index if not exists huddle_passes_one_active_idx
  on public.huddle_passes (huddle_id, user_id)
  where refunded_at is null;
create index if not exists huddle_passes_payment_intent_idx
  on public.huddle_passes (stripe_payment_intent);

alter table public.huddle_passes enable row level security;

drop policy if exists "huddle_passes_select" on public.huddle_passes;
create policy "huddle_passes_select"
  on public.huddle_passes for select
  using (user_id = auth.uid() or public.is_huddle_leader(huddle_id));

-- -----------------------------------------------------------------------------
-- Access for the signed-in user:
--   exempt       free huddle (grandfathered or comped by you)
--   active       paid, started, inside the access window
--   not_started  paid, waiting for the leader to start Week 1
--   unpaid       no pass yet
--   expired      the access window has ended (read-only)
--   none         not in this huddle
-- -----------------------------------------------------------------------------
create or replace function public.huddle_access(hid uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  h public.huddles;
  v_expired boolean;
begin
  select * into h from public.huddles where id = hid;
  if v_uid is null or not found then
    return 'none';
  end if;
  if h.leader_id <> v_uid
     and not exists (select 1 from public.memberships m where m.huddle_id = hid and m.user_id = v_uid) then
    return 'none';
  end if;
  if h.billing_exempt then
    return 'exempt';
  end if;

  v_expired := h.started_at is not null
    and now() >= h.started_at + make_interval(weeks => h.access_weeks);
  if v_expired then
    return 'expired';
  end if;

  if exists (
    select 1 from public.huddle_passes p
    where p.huddle_id = hid and p.user_id = v_uid and p.refunded_at is null
  ) then
    return case when h.started_at is null then 'not_started' else 'active' end;
  end if;
  return 'unpaid';
end;
$$;

revoke all on function public.huddle_access(uuid) from public, anon;
grant execute on function public.huddle_access(uuid) to authenticated;

create or replace function public.has_huddle_access(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.huddle_access(hid) in ('active', 'exempt');
$$;

revoke all on function public.has_huddle_access(uuid) from public, anon;
grant execute on function public.has_huddle_access(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Billing fields are set only by start_huddle and the SQL editor. Leaders need
-- an active pass to advance the week.
-- -----------------------------------------------------------------------------
create or replace function public.huddles_guard_billing()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.billing_exempt := false;
    new.started_at := null;
    new.access_weeks := null;
    return new;
  end if;

  if new.billing_exempt is distinct from old.billing_exempt
     or new.started_at is distinct from old.started_at
     or new.access_weeks is distinct from old.access_weeks then
    raise exception 'HUDDLE_PASS: Billing details can''t be changed from the app.';
  end if;

  if new.current_week is distinct from old.current_week
     and not public.has_huddle_access(new.id) then
    raise exception 'HUDDLE_PASS: Your Huddle Pass isn''t active.';
  end if;

  return new;
end;
$$;

drop trigger if exists huddles_guard_billing on public.huddles;
create trigger huddles_guard_billing
  before insert or update on public.huddles
  for each row execute function public.huddles_guard_billing();

-- Leader starts Week 1: the access window begins now.
create or replace function public.start_huddle(hid uuid)
returns public.huddles
language plpgsql
security definer
set search_path = public
as $$
declare
  h public.huddles;
  v_weeks int;
begin
  select * into h from public.huddles where id = hid for update;
  if not found or h.leader_id <> auth.uid() then
    raise exception 'Only the leader can start the huddle.';
  end if;
  if h.started_at is not null or h.billing_exempt then
    return h;
  end if;
  if public.huddle_access(hid) <> 'not_started' then
    raise exception 'HUDDLE_PASS: Get your Leader Pass before starting Week 1.';
  end if;

  select v.total_weeks into v_weeks from public.pathway_versions v where v.id = h.pathway_version_id;

  update public.huddles
  set started_at = now(),
      -- ceil(weeks x 1.2) in whole numbers
      access_weeks = (v_weeks * 6 + 4) / 5
  where id = hid
  returning * into h;
  return h;
end;
$$;

revoke all on function public.start_huddle(uuid) from public, anon;
grant execute on function public.start_huddle(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Writes need access; reads stay open so expired huddles remain viewable.
-- -----------------------------------------------------------------------------
drop policy if exists "progress_insert_own" on public.progress;
create policy "progress_insert_own"
  on public.progress for insert
  with check (user_id = auth.uid() and public.is_huddle_member(huddle_id) and public.has_huddle_access(huddle_id));

drop policy if exists "progress_update_own" on public.progress;
create policy "progress_update_own"
  on public.progress for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_huddle_member(huddle_id) and public.has_huddle_access(huddle_id));

drop policy if exists "progress_delete_own" on public.progress;
create policy "progress_delete_own"
  on public.progress for delete
  using (user_id = auth.uid() and public.has_huddle_access(huddle_id));

drop policy if exists "picks_insert_leader" on public.huddle_week_picks;
create policy "picks_insert_leader"
  on public.huddle_week_picks for insert
  with check (public.is_huddle_leader(huddle_id) and picked_by = auth.uid() and public.has_huddle_access(huddle_id));

drop policy if exists "picks_update_leader" on public.huddle_week_picks;
create policy "picks_update_leader"
  on public.huddle_week_picks for update
  using (public.is_huddle_leader(huddle_id))
  with check (public.is_huddle_leader(huddle_id) and picked_by = auth.uid() and public.has_huddle_access(huddle_id));

drop policy if exists "journal_notes_insert_own" on public.journal_notes;
create policy "journal_notes_insert_own"
  on public.journal_notes for insert
  with check (user_id = auth.uid() and public.is_huddle_member(huddle_id) and public.has_huddle_access(huddle_id));

drop policy if exists "journal_notes_update_own" on public.journal_notes;
create policy "journal_notes_update_own"
  on public.journal_notes for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_huddle_member(huddle_id) and public.has_huddle_access(huddle_id));

drop policy if exists "journal_notes_delete_own" on public.journal_notes;
create policy "journal_notes_delete_own"
  on public.journal_notes for delete
  using (user_id = auth.uid() and public.has_huddle_access(huddle_id));

drop policy if exists "journal_photos_insert_own" on public.journal_photos;
create policy "journal_photos_insert_own"
  on public.journal_photos for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.journal_notes n
      where n.id = note_id and n.user_id = auth.uid() and public.has_huddle_access(n.huddle_id)
    )
  );

drop policy if exists "journal_photos_delete_own" on public.journal_photos;
create policy "journal_photos_delete_own"
  on public.journal_photos for delete
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.journal_notes n
      where n.id = note_id and public.has_huddle_access(n.huddle_id)
    )
  );

-- Uploads need access. Deletes stay as they were so a leader can always clear files when dissolving.
drop policy if exists "journal_objects_insert_own" on storage.objects;
create policy "journal_objects_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'journal'
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.is_huddle_member(((storage.foldername(name))[1])::uuid)
    and public.has_huddle_access(((storage.foldername(name))[1])::uuid)
  );

-- -----------------------------------------------------------------------------
-- Stripe webhook (service role only)
-- -----------------------------------------------------------------------------

-- Returns 'inserted', 'duplicate_session' (Stripe retry), 'already_has_pass', or
-- 'gone' (huddle dissolved or account deleted before payment finished). The webhook
-- refunds 'already_has_pass' and 'gone'.
create or replace function public.record_stripe_pass(
  p_session_id text,
  p_payment_intent text,
  p_huddle_id uuid,
  p_user_id uuid,
  p_kind text,
  p_amount_cents int
)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.huddle_passes where stripe_session_id = p_session_id) then
    return 'duplicate_session';
  end if;
  if not exists (select 1 from public.huddles where id = p_huddle_id)
     or not exists (select 1 from public.profiles where id = p_user_id) then
    return 'gone';
  end if;
  if exists (
    select 1 from public.huddle_passes
    where huddle_id = p_huddle_id and user_id = p_user_id and refunded_at is null
  ) then
    return 'already_has_pass';
  end if;

  insert into public.huddle_passes (
    huddle_id, user_id, kind, amount_cents, source, stripe_session_id, stripe_payment_intent
  )
  values (p_huddle_id, p_user_id, p_kind, p_amount_cents, 'stripe', p_session_id, p_payment_intent)
  on conflict do nothing;
  return case when found then 'inserted' else 'already_has_pass' end;
end;
$$;

revoke all on function public.record_stripe_pass(text, text, uuid, uuid, text, int) from public, anon, authenticated;
grant execute on function public.record_stripe_pass(text, text, uuid, uuid, text, int) to service_role;

create or replace function public.refund_stripe_pass(p_payment_intent text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.huddle_passes
  set refunded_at = now()
  where stripe_payment_intent = p_payment_intent and refunded_at is null;
$$;

revoke all on function public.refund_stripe_pass(text) from public, anon, authenticated;
grant execute on function public.refund_stripe_pass(text) to service_role;

-- -----------------------------------------------------------------------------
-- Free passes, from the SQL editor only:
--   select public.grant_comp_pass('ABC123', 'someone@example.com');
-- The pass kind follows whether that person leads the huddle.
-- To make a whole huddle free instead:
--   update public.huddles set billing_exempt = true where invite_code = 'ABC123';
-- -----------------------------------------------------------------------------
create or replace function public.grant_comp_pass(p_invite_code text, p_email text)
returns public.huddle_passes
language plpgsql
security definer
set search_path = public
as $$
declare
  h public.huddles;
  v_uid uuid;
  v_pass public.huddle_passes;
begin
  select * into h from public.huddles where invite_code = upper(trim(p_invite_code));
  if not found then
    raise exception 'No huddle with invite code %.', p_invite_code;
  end if;

  select id into v_uid from auth.users where lower(email) = lower(trim(p_email));
  if v_uid is null then
    raise exception 'No account with email %.', p_email;
  end if;

  select * into v_pass from public.huddle_passes
  where huddle_id = h.id and user_id = v_uid and refunded_at is null;
  if found then
    return v_pass;
  end if;

  insert into public.huddle_passes (huddle_id, user_id, kind, amount_cents, source)
  values (h.id, v_uid, case when h.leader_id = v_uid then 'leader' else 'member' end, 0, 'comp')
  returning * into v_pass;
  return v_pass;
end;
$$;

revoke all on function public.grant_comp_pass(text, text) from public, anon, authenticated;
