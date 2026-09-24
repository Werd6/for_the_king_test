#!/usr/bin/env node
/**
 * Converts for_the_king_content1.md into pathway JSON.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const md = fs.readFileSync(path.join(root, 'for_the_king_content1.md'), 'utf8');

const MOVEMENTS = {
  1: 'Abide',
  2: 'Abide',
  3: 'Abide',
  4: 'Abide',
  5: 'Abide',
  6: 'Be Known',
  7: 'Be Known',
  8: 'Be Known',
  9: 'Be Known',
  10: 'Be Known',
  11: 'FOR THE KING',
  12: 'FOR THE KING',
  13: 'FOR THE KING',
  14: 'FOR THE KING',
  15: 'FOR THE KING',
  16: 'Make Disciples',
  17: 'Make Disciples',
  18: 'Make Disciples',
  19: 'Make Disciples',
  20: 'Make Disciples',
};

function pad(n) {
  return String(n).padStart(2, '0');
}

function bullets(section) {
  return section
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('- '))
    .map((l) => l.replace(/^- /, '').replace(/^\[ \]\s*/, '').trim())
    .filter(Boolean);
}

function sectionBody(text, heading) {
  const re = new RegExp(`### ${heading}\\n([\\s\\S]*?)(?=\\n### |\\n---|\n## |$)`);
  const m = text.match(re);
  return m ? m[1].trim() : '';
}

const weekBlocks = md.split(/\n(?=## Week \d+)/).filter((b) => b.startsWith('## Week'));

const weeks = weekBlocks.map((block) => {
  const header = block.match(/^## Week (\d+):\s*(.+)$/m);
  const weekNumber = Number(header[1]);
  const title = header[2].trim();
  const isGroup = /Group Challenge/i.test(title);

  // Intro: after title line until first ### or **Reading**
  const afterTitle = block.replace(/^## Week .+\n/, '');
  let intro = '';
  const readingMatch = afterTitle.match(/\*\*Reading:\*\*\s*(.+)/);
  if (isGroup) {
    intro = afterTitle
      .split(/\n### /)[0]
      .trim();
  } else {
    intro = afterTitle
      .split(/\n\*\*Reading:\*\*/)[0]
      .trim();
  }

  const weekId = `w${pad(weekNumber)}`;

  if (isGroup) {
    const options = bullets(sectionBody(block, 'Choose One')).map((text, i) => ({
      id: `${weekId}-opt${i + 1}`,
      text,
    }));
    const beforeYouGo = bullets(sectionBody(block, 'Before You Go'));
    const closeInPrayer = sectionBody(block, 'Close in Prayer');
    const celebrate = sectionBody(block, 'Celebrate') || undefined;
    return {
      weekNumber,
      title,
      movement: MOVEMENTS[weekNumber],
      type: 'groupChallenge',
      intro,
      options,
      beforeYouGo,
      closeInPrayer,
      celebrate: celebrate && !celebrate.includes('still to be written') ? celebrate : celebrate || null,
      guardrails:
        'Physical challenges should build stewardship and brotherhood, not shame. Scale to age, fitness, injuries, health, and season of life.',
    };
  }

  const reading = readingMatch ? readingMatch[1].trim() : '';
  const discuss = bullets(sectionBody(block, 'Discuss'));
  const talkingToGod = bullets(sectionBody(block, 'Talking to God'));
  const journaling = bullets(sectionBody(block, 'Journaling')).map((text, i) => ({
    id: `${weekId}-j${i + 1}`,
    text,
  }));
  const challenges = bullets(sectionBody(block, "Week's Challenge")).map((text, i) => ({
    id: `${weekId}-c${i + 1}`,
    text,
  }));
  const careText = sectionBody(block, 'Care for the Body');

  return {
    weekNumber,
    title,
    movement: MOVEMENTS[weekNumber],
    type: 'standard',
    intro,
    reading,
    discuss,
    talkingToGod,
    journaling,
    challenges,
    careForTheBody: {
      id: `${weekId}-body`,
      text: careText,
    },
  };
});

// Optional challenge pool
const poolStart = md.indexOf('## Optional Challenge Pool');
const leaderStart = md.indexOf('## Leader Guide');
const poolMd = md.slice(poolStart, leaderStart);
const poolCategories = {};
for (const cat of ['Physical', 'Spiritual', 'Relational', 'Missional']) {
  const body = sectionBody(poolMd.replace(/^## Optional Challenge Pool/, '### Optional Challenge Pool'), cat);
  // sectionBody looks for ### heading — pool uses ### Physical etc.
  const re = new RegExp(`### ${cat}\\n([\\s\\S]*?)(?=\\n### |$)`);
  const m = poolMd.match(re);
  poolCategories[cat.toLowerCase()] = bullets(m ? m[1] : '').map((text, i) => ({
    id: `pool-${cat.toLowerCase()}-${i + 1}`,
    text,
  }));
}
const guardrailsMatch = poolMd.match(/### Physical Challenge Guardrails\n([\s\S]*?)(?=\n---|\n## |$)/);
const poolGuardrails = guardrailsMatch ? guardrailsMatch[1].trim() : '';

const leaderMd = md.slice(leaderStart);
const leaderIntro = leaderMd
  .replace(/^## Leader Guide\n/, '')
  .split(/\n### /)[0]
  .trim();

const movements = [1, 2, 3, 4].map((n) => {
  const names = ['Abide', 'Be Known', 'FOR THE KING', 'Make Disciples'];
  const heading = `Movement ${n}: ${names[n - 1]}`;
  const re = new RegExp(`### ${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n([\\s\\S]*?)(?=\\n### |$)`);
  const m = leaderMd.match(re);
  const body = m ? m[1] : '';
  const watch = (body.match(/\*\*Watch for:\*\*\s*(.+)/) || [])[1] || '';
  const force = (body.match(/\*\*Do not force:\*\*\s*(.+)/) || [])[1] || '';
  return { name: names[n - 1], watchFor: watch.trim(), doNotForce: force.trim() };
});

const checkIn = bullets(sectionBody(leaderMd, 'A Simple Leader Check-In'));
const visionBody = sectionBody(leaderMd, 'Final Vision');
const visionLines = visionBody
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l.startsWith('- '))
  .map((l) => l.replace(/^- /, ''));
const visionIntro = visionBody.split('\n- ')[0].trim();
const visionClose = visionBody.split('\n\n').slice(-1)[0]?.trim() || '';

const pathway = {
  id: 'for-the-king-v1',
  name: 'FOR THE KING',
  description: 'A 20-week huddle pathway.',
  totalWeeks: 20,
  weeks,
};

const outDir = path.join(root, 'content');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'pathway.json'), JSON.stringify(pathway, null, 2));
fs.writeFileSync(
  path.join(outDir, 'challenge-pool.json'),
  JSON.stringify({ intro: poolMd.split('\n\n')[1], categories: poolCategories, guardrails: poolGuardrails }, null, 2)
);
fs.writeFileSync(
  path.join(outDir, 'leader-guide.json'),
  JSON.stringify(
    {
      intro: leaderIntro,
      movements,
      checkIn,
      finalVision: { intro: visionIntro, points: visionLines, closing: visionClose },
    },
    null,
    2
  )
);

console.log(`Wrote ${weeks.length} weeks to content/`);
