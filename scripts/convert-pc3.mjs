#!/usr/bin/env node
/**
 * Converts content/pathways/pc3-focuses/source.md (the formatted Focuses guide) into
 * content/pathways/pc3-focuses/pathway.json.
 *
 * Structure expected in the markdown:
 *   ## <Front-matter section>            → pathway resource
 *   ## <Value>: <Tagline>                → core value (preface for its first focus)
 *   ### <Focus>                          → one week
 *     #### Definition | Quotes | Article | SOAP | Discipleship Challenge Options
 *     #### Discipleship Questions | Discipleship Challenge Review
 *   ## Bibliography / ## Closing         → pathway resources
 *
 * Usage: npm run content:pc3
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, '..', 'content', 'pathways', 'pc3-focuses');
const md = fs.readFileSync(path.join(dir, 'source.md'), 'utf8');

const SKIP_RESOURCES = new Set(['Contents']);
const CORE_VALUES = new Set(['Gospel', 'Formation', 'Community', 'Mission']);

function fail(msg) {
  console.error(`convert-pc3: ${msg}`);
  process.exit(1);
}

function slug(s) {
  return s
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Artwork placeholders like *[FOCUS ARTWORK INSERT: ACCEPT]* are for print only. */
const isPlaceholder = (line) => /^\*\[.*\]\*$/.test(line.trim());

/** Joins wrapped lines with spaces; a trailing backslash is a hard line break. */
const joinLines = (lines) =>
  lines
    .map((l) => l.trim())
    .map((l) => (l.endsWith('\\') ? `${l.slice(0, -1)}\n` : `${l} `))
    .join('')
    .trim();

function parseQuote(lines) {
  const body = lines.map((l) => l.replace(/^>\s?/, ''));
  const paras = [];
  let cur = [];
  for (const l of body) {
    if (l.trim() === '') {
      if (cur.length) paras.push(cur);
      cur = [];
    } else cur.push(l);
  }
  if (cur.length) paras.push(cur);
  const text = (p) =>
    p
      .map((l) => l.replace(/\\$/, '').trim())
      .join(p.some((l) => l.endsWith('\\')) ? '\n' : ' ');
  let source;
  const last = paras.length > 1 ? text(paras[paras.length - 1]) : null;
  if (last && /^(— |\()/.test(last)) {
    source = last.replace(/^— /, '');
    paras.pop();
  }
  return { type: 'quote', text: paras.map(text).join('\n\n'), ...(source ? { source } : {}) };
}

/** Minimal markdown → StudyBlock[] for the constructs used in source.md. */
function parseBlocks(lines) {
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '' || line.trim() === '---' || isPlaceholder(line)) {
      i++;
      continue;
    }
    if (/^#{3,6} /.test(line)) {
      blocks.push({ type: 'heading', text: line.replace(/^#+ /, '').trim() });
      i++;
      continue;
    }
    if (line.startsWith('>')) {
      const q = [];
      while (i < lines.length && lines[i].startsWith('>')) q.push(lines[i++]);
      blocks.push(parseQuote(q));
      continue;
    }
    const listMatch = /^(- |\d+\. )/.exec(line);
    if (listMatch) {
      const ordered = listMatch[1] !== '- ';
      const items = [];
      while (i < lines.length && /^(- |\d+\. )/.test(lines[i])) {
        const itemLines = [lines[i].replace(/^(- |\d+\. )/, '')];
        i++;
        while (i < lines.length && (lines[i].startsWith('  ') || lines[i].trim() === '')) {
          if (lines[i].trim() === '' && !(lines[i + 1] ?? '').startsWith('  ')) break;
          itemLines.push(lines[i].replace(/^ {2}/, ''));
          i++;
        }
        items.push(itemLines);
      }
      blocks.push({ type: 'list', ordered, rawItems: items });
      continue;
    }
    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#|>|- |\d+\. |---)/.test(lines[i]) &&
      !isPlaceholder(lines[i])
    ) {
      para.push(lines[i++]);
    }
    blocks.push({ type: 'paragraph', text: joinLines(para) });
  }
  // Content indented under a list item follows that item, then the list continues.
  return blocks.flatMap((b) => {
    if (b.type !== 'list') return [b];
    const out = [];
    let items = [];
    const flush = () => {
      if (items.length) out.push({ type: 'list', items, ...(b.ordered ? { ordered: true } : {}) });
      items = [];
    };
    for (const it of b.rawItems) {
      items.push(it[0].trim());
      const body = it.slice(1);
      if (body.some((l) => l.trim())) {
        flush();
        out.push(...parseBlocks(body));
      }
    }
    flush();
    return out;
  });
}

/** Top-level list items become options; indented lines under each become its details. */
function parseOptions(lines, weekNo) {
  const items = [];
  let cur = null;
  const trailing = [];
  for (const line of lines) {
    if (line.startsWith('- ')) {
      cur = { text: line.slice(2).trim(), body: [] };
      items.push(cur);
    } else if (cur && (line.startsWith('  ') || line.trim() === '')) {
      cur.body.push(line.replace(/^ {2}/, ''));
    } else if (line.trim() && !/^\*\(.*\)\*$/.test(line.trim())) {
      trailing.push(line);
    }
  }
  if (trailing.some((l) => l.trim())) {
    fail(`week ${weekNo}: text after the challenge options list must be indented under an option:\n  ${trailing[0]}`);
  }
  return items.map((it, idx) => {
    const details = parseBlocks(it.body);
    return {
      id: `pc3-w${String(weekNo).padStart(2, '0')}-c${idx + 1}`,
      text: it.text,
      ...(details.length ? { details } : {}),
    };
  });
}

const listItems = (lines) =>
  lines.filter((l) => l.startsWith('- ')).map((l) => l.slice(2).trim());

// ---------------------------------------------------------------------------
// Split into ## sections
// ---------------------------------------------------------------------------

const lines = md.split('\n');
const sections = [];
for (const line of lines) {
  const h2 = /^## (.+)$/.exec(line);
  if (h2) sections.push({ title: h2[1].trim(), lines: [] });
  else if (sections.length) sections[sections.length - 1].lines.push(line);
}

const resources = [];
const weeks = [];

function splitBy(prefix, sectionLines) {
  const head = [];
  const parts = [];
  for (const line of sectionLines) {
    if (line.startsWith(prefix)) parts.push({ title: line.slice(prefix.length).trim(), lines: [] });
    else if (parts.length) parts[parts.length - 1].lines.push(line);
    else head.push(line);
  }
  return { head, parts };
}

for (const section of sections) {
  const valueMatch = /^(\w+): (.+)$/.exec(section.title);
  if (valueMatch && CORE_VALUES.has(valueMatch[1])) {
    const [, value] = valueMatch;
    const { head, parts } = splitBy('### ', section.lines);
    const placement = parts.find((p) => p.title === 'Placement & Purpose');
    const focuses = parts.filter((p) => p !== placement);
    if (!placement) fail(`${value}: missing "### Placement & Purpose"`);
    const preface = {
      title: section.title,
      blocks: [
        ...parseBlocks(head),
        { type: 'heading', text: 'Placement & Purpose' },
        ...parseBlocks(placement.lines),
      ],
    };

    focuses.forEach((focus, idx) => {
      const weekNumber = weeks.length + 1;
      const { parts: subs } = splitBy('#### ', focus.lines);
      const sub = (name) => {
        const found = subs.find((s) => s.title === name);
        if (!found) fail(`${focus.title}: missing "#### ${name}"`);
        return found.lines;
      };
      const definition = joinLines(sub('Definition').filter((l) => l.trim()));
      const quotes = parseBlocks(sub('Quotes'))
        .filter((b) => b.type === 'quote')
        .map((q) => ({ text: q.text, source: q.source ?? '' }));
      const soapPassages = listItems(sub('SOAP'));
      const pad = String(weekNumber).padStart(2, '0');

      weeks.push({
        weekNumber,
        title: focus.title,
        movement: value,
        type: 'standard',
        intro: definition,
        reading: soapPassages.join('; '),
        discuss: listItems(sub('Discipleship Questions')),
        soap: soapPassages.map((p, n) => ({ id: `pc3-w${pad}-s${n + 1}`, text: p })),
        challengeMode: 'chooseOne',
        challenges: parseOptions(sub('Discipleship Challenge Options'), weekNumber),
        challengeReview: listItems(sub('Discipleship Challenge Review')),
        study: {
          ...(idx === 0 ? { preface } : {}),
          definition,
          quotes,
          article: parseBlocks(sub('Article')),
        },
      });
    });
    continue;
  }

  if (SKIP_RESOURCES.has(section.title)) continue;
  const blocks = parseBlocks(section.lines);
  if (blocks.length) resources.push({ id: slug(section.title), title: section.title, blocks });
}

if (weeks.length !== 12) fail(`expected 12 focuses, found ${weeks.length}`);

const credits = resources.findIndex((r) => r.id === 'copyright-and-credits');
if (credits >= 0) resources.push(...resources.splice(credits, 1));

const pathway = {
  id: 'pc3-focuses-v1',
  name: 'Focuses',
  description:
    'The PC3 Discipleship Guide from Providence Church — 12 weeks through Gospel, Formation, Community, and Mission.',
  totalWeeks: weeks.length,
  weeks,
  resources,
};

fs.writeFileSync(path.join(dir, 'pathway.json'), `${JSON.stringify(pathway, null, 2)}\n`);
console.log(
  `Wrote ${weeks.length} weeks and ${resources.length} resources (${resources.map((r) => r.title).join(', ')}).`
);
