-- =============================================================================
-- Phase 1 security migration
-- Paste into: Supabase Dashboard → SQL Editor → Run (safe to re-run)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Stop any signed-in user from reading every huddle
-- -----------------------------------------------------------------------------
drop policy if exists "huddles_select_by_invite_for_join" on public.huddles;

-- -----------------------------------------------------------------------------
-- 2. Join by invite code server-side
-- -----------------------------------------------------------------------------
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

  insert into public.memberships (huddle_id, user_id)
  values (v_huddle.id, v_uid);

  return v_huddle;
end;
$$;

revoke all on function public.join_huddle_by_code(text) from public, anon;
grant execute on function public.join_huddle_by_code(text) to authenticated;

-- Direct membership inserts are now only for a leader adding themselves to a
-- huddle they just created. Everyone else joins through join_huddle_by_code.
drop policy if exists "memberships_insert_self" on public.memberships;
create policy "memberships_insert_self"
  on public.memberships for insert
  with check (user_id = auth.uid() and public.is_huddle_leader(huddle_id));

-- -----------------------------------------------------------------------------
-- 3. Real account deletion
-- -----------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not signed in.';
  end if;

  -- huddles.leader_id and huddle_week_picks.picked_by don't cascade, so clear
  -- them first. Deleting a led huddle cascades its memberships/progress/picks.
  delete from public.huddles where leader_id = v_uid;
  delete from public.huddle_week_picks where picked_by = v_uid;

  -- Cascades to profiles → memberships, progress.
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- -----------------------------------------------------------------------------
-- 4. RLS audit fixes
-- -----------------------------------------------------------------------------

-- Leaders couldn't hand the huddle to someone else by rewriting leader_id.
drop policy if exists "huddles_update_leader" on public.huddles;
create policy "huddles_update_leader"
  on public.huddles for update
  using (leader_id = auth.uid())
  with check (leader_id = auth.uid());

-- Checkmark upserts need an UPDATE policy when the row already exists.
drop policy if exists "progress_update_own" on public.progress;
create policy "progress_update_own"
  on public.progress for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_huddle_member(huddle_id));

-- Picks must stay attributed to the leader making the change.
drop policy if exists "picks_update_leader" on public.huddle_week_picks;
create policy "picks_update_leader"
  on public.huddle_week_picks for update
  using (public.is_huddle_leader(huddle_id))
  with check (public.is_huddle_leader(huddle_id) and picked_by = auth.uid());
