#!/usr/bin/env node
/**
 * Publish content/pathway.json (+ leader guide + challenge pool) to Supabase.
 *
 * Prerequisites:
 *   1. Run supabase/schema.sql in the Supabase SQL editor
 *   2. Create .env with:
 *        EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
 *        SUPABASE_SERVICE_ROLE_KEY=eyJ...   (Project Settings → API → service_role)
 *   3. npm run content   (if you edited the markdown)
 *
 * Usage:
 *   node --env-file=.env scripts/publish-pathway.mjs
 *   node --env-file=.env scripts/publish-pathway.mjs --version 1
 *   node --env-file=.env scripts/publish-pathway.mjs --new-version
 *
 * Never put the service_role key in the Expo app or EXPO_PUBLIC_* vars.
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const PATHWAY_ID = 'for-the-king';

function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}

function parseArgs(argv) {
  const args = { version: null, newVersion: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--version' && argv[i + 1]) {
      args.version = Number(argv[++i]);
    } else if (argv[i] === '--new-version') {
      args.newVersion = true;
    }
  }
  return args;
}

function weekToRow(pathwayVersionId, week) {
  const {
    weekNumber,
    title,
    movement,
    type,
    ...content
  } = week;

  return {
    pathway_version_id: pathwayVersionId,
    week_number: weekNumber,
    title,
    movement: movement ?? null,
    week_type: type,
    content,
  };
}

async function main() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || url.includes('YOUR_PROJECT')) {
    console.error('Missing EXPO_PUBLIC_SUPABASE_URL in .env');
    process.exit(1);
  }
  if (!serviceKey || serviceKey.includes('YOUR_')) {
    console.error(
      'Missing SUPABASE_SERVICE_ROLE_KEY in .env\n' +
        'Supabase → Project Settings → API → service_role (secret). Do not use the anon key.'
    );
    process.exit(1);
  }

  const args = parseArgs(process.argv.slice(2));
  const pathway = loadJson('content/pathway.json');
  const leaderGuide = loadJson('content/leader-guide.json');
  const challengePool = loadJson('content/challenge-pool.json');

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`Publishing pathway "${PATHWAY_ID}" (${pathway.weeks.length} weeks)…`);

  // 1) Upsert catalog row
  const { error: pathwayErr } = await supabase.from('pathways').upsert(
    {
      id: PATHWAY_ID,
      name: pathway.name,
      description: pathway.description,
      is_published: true,
      sort_order: 1,
    },
    { onConflict: 'id' }
  );
  if (pathwayErr) throw pathwayErr;

  // 2) Resolve version number
  const { data: existing, error: listErr } = await supabase
    .from('pathway_versions')
    .select('id, version, is_published')
    .eq('pathway_id', PATHWAY_ID)
    .order('version', { ascending: false });
  if (listErr) throw listErr;

  const latest = existing?.[0] ?? null;
  let versionNum;
  if (args.version != null) {
    versionNum = args.version;
  } else if (args.newVersion) {
    versionNum = (latest?.version ?? 0) + 1;
  } else if (latest && !latest.is_published) {
    versionNum = latest.version; // republish into unpublished draft
  } else if (!latest) {
    versionNum = 1;
  } else {
    // Default: create a new version if latest is already published
    versionNum = latest.version + 1;
    console.log(`Latest v${latest.version} is published — creating v${versionNum}.`);
  }

  // 3) Upsert version (unpublished while we load weeks)
  let versionId = existing?.find((v) => v.version === versionNum)?.id;

  if (versionId) {
    const { error } = await supabase
      .from('pathway_versions')
      .update({
        label: `v${versionNum}`,
        total_weeks: pathway.totalWeeks ?? pathway.weeks.length,
        leader_guide: leaderGuide,
        challenge_pool: challengePool,
        is_published: false,
        published_at: null,
      })
      .eq('id', versionId);
    if (error) throw error;

    // Clear old weeks for this version so we can reinsert cleanly
    const { error: delErr } = await supabase
      .from('pathway_weeks')
      .delete()
      .eq('pathway_version_id', versionId);
    if (delErr) throw delErr;
  } else {
    const { data, error } = await supabase
      .from('pathway_versions')
      .insert({
        pathway_id: PATHWAY_ID,
        version: versionNum,
        label: `v${versionNum}`,
        total_weeks: pathway.totalWeeks ?? pathway.weeks.length,
        leader_guide: leaderGuide,
        challenge_pool: challengePool,
        is_published: false,
      })
      .select('id')
      .single();
    if (error) throw error;
    versionId = data.id;
  }

  console.log(`Using pathway_version ${versionId} (v${versionNum})`);

  // 4) Insert weeks
  const rows = pathway.weeks.map((w) => weekToRow(versionId, w));
  const { error: weeksErr } = await supabase.from('pathway_weeks').insert(rows);
  if (weeksErr) throw weeksErr;
  console.log(`Inserted ${rows.length} weeks.`);

  // 5) Publish
  const { error: pubErr } = await supabase
    .from('pathway_versions')
    .update({ is_published: true, published_at: new Date().toISOString() })
    .eq('id', versionId);
  if (pubErr) throw pubErr;

  console.log(`Published ${PATHWAY_ID} v${versionNum}.`);
  console.log('Verify in SQL: select * from pathways_available;');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
