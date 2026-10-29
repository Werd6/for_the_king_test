-- Stripe Payment Links for Huddle Passes, one per pathway and pass kind (the price depends on
-- the pathway's length). Get Huddle Pass opens these directly. Paste each link in Supabase →
-- Table Editor → pathways once it's created in Stripe; no app build needed. While a link is
-- empty, the app says passes for that pathway aren't available yet.
-- Run in Supabase → SQL Editor. Safe to run more than once.

alter table public.pathways
  add column if not exists leader_pass_link text,
  add column if not exists member_pass_link text;
