-- Go and Make is a paid app ($4.99 on the App Store and Google Play), so Huddle
-- Passes are off: every huddle, existing and new, is free (billing_exempt), which
-- gives everyone in it full access. The pass tables and functions from 006 stay
-- in place, unused. Run after 006. Run in Supabase → SQL Editor. Safe to re-run.
--
-- To turn passes back on: re-run 006_huddle_passes.sql (new huddles start unpaid
-- again), then set billing_exempt = false on the huddles that should pay.

alter table public.huddles alter column billing_exempt set default true;
update public.huddles set billing_exempt = true where not billing_exempt;

-- Same as 006, except huddles created in the app start free.
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
    new.billing_exempt := true;
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
