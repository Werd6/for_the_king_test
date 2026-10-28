-- Pathways can be left out of the iPhone and Android apps while the web app
-- still offers them. The apps only list pathways with in_apps = true when
-- creating a huddle. Run in Supabase → SQL Editor. Safe to run more than once.

alter table public.pathways add column if not exists in_apps boolean not null default true;

create or replace view public.pathways_available as
select
  p.id as pathway_id,
  p.name,
  p.description,
  p.sort_order,
  pv.id as pathway_version_id,
  pv.version,
  pv.total_weeks,
  pv.published_at,
  p.in_apps
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

-- Focuses (PC3) is web only until its licensing is settled. To offer it in the
-- apps again: update public.pathways set in_apps = true where id = 'pc3-focuses';
update public.pathways set in_apps = false where id = 'pc3-focuses';
