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
 *   node --env-file=.env scripts/publish-pathway.mjs --theme-only   (branding only, no new content version)
 *
 * Theme: content/theme.json, with logo/favicon files in content/assets/ (embedded as data URIs).
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
  const args = { version: null, newVersion: false, themeOnly: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--version' && argv[i + 1]) {
      args.version = Number(argv[++i]);
    } else if (argv[i] === '--new-version') {
      args.newVersion = true;
    } else if (argv[i] === '--theme-only') {
      args.themeOnly = true;
    }
  }
  return args;
}

// ---------------------------------------------------------------------------
// Theme (mirrors the checks in lib/pathwayTheme.ts)
// ---------------------------------------------------------------------------

const THEME_FILE = 'content/theme.json';
const THEME_ASSET_DIR = 'content/assets';
const IMAGE_LIMITS = { logo: 150 * 1024, logoDark: 150 * 1024, favicon: 32 * 1024 };
const IMAGE_MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const HEX = /^#[0-9a-f]{6}$/i;
const CONTRAST_PAIRS = [
  ['ink', 'bg'],
  ['ink', 'surface'],
  ['mutedText', 'bg'],
  ['onPrimary', 'primary'],
];

function channel(hex, offset) {
  const c = parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function contrastRatio(a, b) {
  const lum = (h) => 0.2126 * channel(h, 1) + 0.7152 * channel(h, 3) + 0.0722 * channel(h, 5);
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Validates content/theme.json and embeds referenced images. Exits on any problem. */
function buildTheme() {
  const themePath = path.join(root, THEME_FILE);
  if (!fs.existsSync(themePath)) return null;
  const theme = loadJson(THEME_FILE);
  const errors = [];

  for (const mode of ['light', 'dark']) {
    const palette = theme[mode];
    if (palette == null) continue;
    for (const [key, value] of Object.entries(palette)) {
      if (!HEX.test(value)) errors.push(`${mode}.${key}: "${value}" is not a #RRGGBB color`);
    }
    for (const [fg, bg] of CONTRAST_PAIRS) {
      if (!palette[fg] || !palette[bg]) {
        errors.push(`${mode}: needs both "${fg}" and "${bg}" for the readability check`);
        continue;
      }
      if (!HEX.test(palette[fg]) || !HEX.test(palette[bg])) continue;
      const ratio = contrastRatio(palette[fg], palette[bg]);
      if (ratio < 4.5) errors.push(`${mode}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1 (needs 4.5:1)`);
    }
  }

  for (const [key, value] of Object.entries(theme.radii ?? {})) {
    if (typeof value !== 'number' || value < 0 || value > 32) errors.push(`radii.${key} must be 0–32`);
  }
  if (theme.spacingScale != null && (theme.spacingScale < 0.75 || theme.spacingScale > 1.5)) {
    errors.push('spacingScale must be between 0.75 and 1.5');
  }

  const embedded = { ...theme };
  for (const [key, limit] of Object.entries(IMAGE_LIMITS)) {
    const value = theme[key];
    if (!value || value.startsWith('data:') || value.startsWith('https://')) continue;
    const file = path.join(root, THEME_ASSET_DIR, value);
    const mime = IMAGE_MIME[path.extname(value).toLowerCase()];
    if (!mime) {
      errors.push(`${key}: "${value}" must be .png, .jpg, or .webp`);
      continue;
    }
    if (!fs.existsSync(file)) {
      errors.push(`${key}: ${THEME_ASSET_DIR}/${value} not found`);
      continue;
    }
    const bytes = fs.readFileSync(file);
    if (bytes.length > limit) {
      errors.push(`${key}: ${value} is ${Math.round(bytes.length / 1024)} KB (max ${limit / 1024} KB)`);
      continue;
    }
    embedded[key] = `data:${mime};base64,${bytes.toString('base64')}`;
  }

  if (errors.length) {
    console.error(`Theme problems in ${THEME_FILE}:\n  - ${errors.join('\n  - ')}`);
    process.exit(1);
  }
  return embedded;
}

/** Key-order-independent JSON, since jsonb reorders keys. */
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

async function publishTheme(supabase, theme) {
  if (!theme) {
    console.log(`No ${THEME_FILE}; skipping theme.`);
    return;
  }
  const { data: current, error } = await supabase
    .from('pathways')
    .select('theme, theme_version')
    .eq('id', PATHWAY_ID)
    .single();
  if (error) {
    throw new Error(
      `${error.message}\nRun supabase/migrations/002_pathway_theme.sql in the Supabase SQL Editor first.`
    );
  }
  if (stableStringify(current.theme ?? {}) === stableStringify(theme)) {
    console.log(`Theme unchanged (v${current.theme_version}).`);
    return;
  }
  const nextVersion = (current.theme_version ?? 0) + 1;
  const { error: updErr } = await supabase
    .from('pathways')
    .update({ theme, theme_version: nextVersion })
    .eq('id', PATHWAY_ID);
  if (updErr) throw updErr;
  console.log(`Published theme v${nextVersion}.`);
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
  const theme = buildTheme();
  const pathway = loadJson('content/pathway.json');
  const leaderGuide = loadJson('content/leader-guide.json');
  const challengePool = loadJson('content/challenge-pool.json');

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (args.themeOnly) {
    await publishTheme(supabase, theme);
    return;
  }

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

  await publishTheme(supabase, theme);

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
