-- =============================================================================
-- Push notifications: device tokens, plus server-sent notifications when the
-- huddle starts the next week and when a member finishes a checklist item.
-- Sends through Expo's push service with pg_net. Safe to re-run.
-- Paste into: Supabase Dashboard → SQL Editor → Run
-- =============================================================================

create extension if not exists pg_net with schema extensions;

create table if not exists public.push_tokens (
  token text primary key,                       -- Expo push token, one per device
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);

create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

-- No policies: tokens are only read and written by the functions below.
alter table public.push_tokens enable row level security;

-- A device belongs to whoever signed in on it last.
create or replace function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in.';
  end if;
  insert into public.push_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), p_platform, now())
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;

revoke all on function public.register_push_token(text, text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;

create or replace function public.unregister_push_token(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
$$;

revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.unregister_push_token(text) to authenticated;

-- One "finished" notification per member, week and item, even if it's unchecked and checked again.
create table if not exists public.push_completions (
  huddle_id uuid not null references public.huddles (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  week int not null,
  item_id text not null,
  sent_at timestamptz not null default now(),
  primary key (huddle_id, user_id, week, item_id)
);

alter table public.push_completions enable row level security;

-- Every member of the huddle except p_except gets the notification, branded for
-- the huddle's pathway: Android shows the icon the app bundles as
-- notification_icon_<pathway id> (plugins/withPathwayNotificationIcons.js), or
-- the default icon if this build doesn't have one.
create or replace function public.push_to_huddle(
  p_huddle uuid, p_except uuid, p_title text, p_body text, p_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_messages jsonb;
begin
  select jsonb_agg(jsonb_build_object(
    'to', t.token,
    'title', p_title,
    'body', p_body,
    'sound', 'default',
    'channelId', 'default',
    'icon', 'notification_icon_' || replace(h.pathway_id, '-', '_'),
    'data', jsonb_build_object('url', p_url)
  ))
  into v_messages
  from public.huddles h
  join public.memberships m on m.huddle_id = h.id
  join public.push_tokens t on t.user_id = m.user_id
  where h.id = p_huddle and m.user_id is distinct from p_except;

  if v_messages is null then
    return;
  end if;

  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    body := v_messages,
    headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
  );
end;
$$;

revoke all on function public.push_to_huddle(uuid, uuid, text, text, text) from public, anon, authenticated;

-- "Huddle has started the next week" to everyone but the leader who advanced it.
create or replace function public.notify_week_started()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
begin
  if new.current_week <= old.current_week then
    return null;
  end if;
  begin
    select pw.title into v_title
    from public.pathway_weeks pw
    where pw.pathway_version_id = new.pathway_version_id and pw.week_number = new.current_week;

    perform public.push_to_huddle(
      new.id,
      coalesce(auth.uid(), new.leader_id),
      'Huddle has started the next week',
      'Week ' || new.current_week || coalesce(': ' || v_title, ''),
      '/'
    );
  exception when others then
    -- Never block advancing the week over a notification.
    raise warning 'notify_week_started: %', sqlerrm;
  end;
  return null;
end;
$$;

drop trigger if exists huddles_notify_week_started on public.huddles;
create trigger huddles_notify_week_started
  after update of current_week on public.huddles
  for each row execute function public.notify_week_started();

-- "{member} has finished {item}!" once an item is fully checked off (every day, for daily items).
create or replace function public.notify_item_finished()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_id text := split_part(new.item_id, '@d', 1);
  v_item jsonb;
  v_days int;
  v_done int;
  v_label text;
  v_name text;
begin
  begin
    select jsonb_path_query_first(pw.content, '$.** ? (@.id == $id)', jsonb_build_object('id', v_item_id))
      into v_item
    from public.huddles h
    join public.pathway_weeks pw
      on pw.pathway_version_id = h.pathway_version_id and pw.week_number = new.week
    where h.id = new.huddle_id;

    if v_item is null then
      return null;
    end if;

    -- A single day box: only the last missing day finishes the item.
    if new.item_id <> v_item_id then
      v_days := nullif(v_item->>'days', '')::int;
      if v_days is null then
        return null;
      end if;
      select count(*) into v_done
      from public.progress p
      where p.huddle_id = new.huddle_id
        and p.user_id = new.user_id
        and p.week = new.week
        and p.item_id in (select v_item_id || '@d' || d from generate_series(1, v_days) d);
      if v_done < v_days then
        return null;
      end if;
    end if;

    insert into public.push_completions (huddle_id, user_id, week, item_id)
    values (new.huddle_id, new.user_id, new.week, v_item_id)
    on conflict do nothing;
    if not found then
      return null;
    end if;

    v_label := case
      when v_item_id like '%-body' then 'Care for the Body'
      else coalesce(v_item->>'text', 'a challenge')
    end;
    if char_length(v_label) > 60 then
      v_label := left(v_label, 57) || '…';
    end if;

    select display_name into v_name from public.profiles where id = new.user_id;

    perform public.push_to_huddle(
      new.huddle_id,
      new.user_id,
      coalesce(v_name, 'A brother') || ' has finished “' || v_label || '”!',
      'Send encouragement!',
      '/progress?member=' || new.user_id
    );
  exception when others then
    -- Never block a check-off over a notification.
    raise warning 'notify_item_finished: %', sqlerrm;
  end;
  return null;
end;
$$;

drop trigger if exists progress_notify_item_finished on public.progress;
create trigger progress_notify_item_finished
  after insert on public.progress
  for each row execute function public.notify_item_finished();
