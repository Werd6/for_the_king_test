-- =============================================================================
-- A device can receive notifications for every account saved on it.
-- Apply after 005_push_notifications.sql. Existing registrations are preserved.
-- Paste into: Supabase Dashboard → SQL Editor → Run
-- =============================================================================

begin;

alter table public.push_tokens drop constraint if exists push_tokens_pkey;
alter table public.push_tokens add primary key (token, user_id);

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
  on conflict (token, user_id) do update
    set platform = excluded.platform, updated_at = now();
end;
$$;

revoke all on function public.register_push_token(text, text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;

-- unregister_push_token already scopes deletion to auth.uid(), so signing out
-- of one account keeps other accounts registered with the same device token.

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
    'body', h.name || ': ' || p_body,
    'sound', 'default',
    'channelId', 'default',
    'icon', 'notification_icon_' || replace(h.pathway_id, '-', '_'),
    'data', jsonb_build_object('url', p_url, 'userId', t.user_id, 'huddleId', h.id)
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

commit;
