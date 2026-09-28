-- =============================================================================
-- Pathway theming
-- Paste into: Supabase Dashboard → SQL Editor → Run (safe to re-run)
-- =============================================================================

-- Theme JSON (colors, radii, spacing, embedded logos/favicon, icon key).
-- Written by `npm run publish:pathway` from content/theme.json.
alter table public.pathways
  add column if not exists theme jsonb not null default '{}'::jsonb;

-- Bumped on every theme change so apps only re-download when it's newer.
alter table public.pathways
  add column if not exists theme_version int not null default 0;
