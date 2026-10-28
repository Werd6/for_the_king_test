-- Gender-neutral fallbacks: "Member" for a profile with no display name, and
-- "Someone has finished …" when a finisher has no display name.
-- Run in Supabase → SQL Editor. Safe to run more than once.

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
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'Member'),
    new.email
  );
  return new;
end;
$$;

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
      coalesce(v_name, 'Someone') || ' has finished “' || v_label || '”!',
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
