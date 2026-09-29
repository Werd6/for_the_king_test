-- Pathway-wide guide pages (How to SOAP, Huddle Rhythms, …) shown in the Study tab.
-- Safe to run more than once.

alter table public.pathway_versions
  add column if not exists resources jsonb not null default '[]'::jsonb;
