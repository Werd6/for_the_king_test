-- Multi-day items ("Read John 15 each day"): notify the huddle on every day checked off,
-- not only when the last day finishes the item.
--   Each day:  "{member} has done 3 of 7 days of “{item}”"
--   Last day:  "{member} has finished “{item}”!" (unchanged)
-- Days can be checked in any order, so the message counts days rather than naming one.
-- push_completions records each count reached (item id + '@n' + count), so unchecking
-- and re-checking a day doesn't send the same notification again.
-- Run in Supabase → SQL Editor. Safe to run more than once.

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
  v_key text;
  v_label text;
  v_name text;
  v_title text;
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

    v_key := v_item_id;
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
        v_key := v_item_id || '@n' || v_done;
      end if;
    end if;

    insert into public.push_completions (huddle_id, user_id, week, item_id)
    values (new.huddle_id, new.user_id, new.week, v_key)
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
    v_name := coalesce(v_name, 'Someone');

    v_title := case
      when v_key = v_item_id then v_name || ' has finished “' || v_label || '”!'
      else v_name || ' has done ' || v_done || ' of ' || v_days || ' days of “' || v_label || '”'
    end;

    perform public.push_to_huddle(
      new.huddle_id,
      new.user_id,
      v_title,
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
