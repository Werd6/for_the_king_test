import pathwayData from '@/content/pathway.json';
import challengePoolData from '@/content/challenge-pool.json';
import leaderGuideData from '@/content/leader-guide.json';
import pc3PathwayData from '@/content/pathways/pc3-focuses/pathway.json';
import type { RawPathwayTheme } from '@/lib/pathwayTheme';
import { isRemoteConfigured, readJson, supabase, writeJson } from '@/lib/supabase';
import { BUNDLED_THEMES } from '@/lib/themeAssets';
import type { Pathway, PathwayResource, PathwayWeek, StandardWeek } from '@/lib/types';

const CACHE_KEY = 'ftk.pathwayCache';
const THEME_CACHE_KEY = 'ftk.themeCache';

export type LeaderGuide = typeof leaderGuideData;
export type ChallengePool = typeof challengePoolData;

type BundledPathway = {
  pathway: Pathway;
  leaderGuide: LeaderGuide | null;
  challengePool: ChallengePool | null;
};

/** Pathways shipped with the app: offline fallback and local (no cloud) mode. */
const BUNDLED_PATHWAYS: Record<string, BundledPathway> = {
  'for-the-king': {
    pathway: pathwayData as Pathway,
    leaderGuide: leaderGuideData,
    challengePool: challengePoolData,
  },
  'pc3-focuses': {
    pathway: pc3PathwayData as Pathway,
    leaderGuide: null,
    challengePool: null,
  },
};

const DEFAULT_PATHWAY_ID = 'for-the-king';

/** For The King keeps the original `local` id so existing local huddles still resolve. */
function localVersionId(pathwayId: string) {
  return pathwayId === DEFAULT_PATHWAY_ID ? 'local' : `local:${pathwayId}`;
}

export function isLocalVersionId(id: string | null | undefined) {
  return !id || id === 'local' || id.startsWith('local:');
}

function isNonEmptyObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length > 0;
}

export type PathwayOption = {
  pathwayId: string;
  pathwayVersionId: string;
  name: string;
  description: string;
  totalWeeks: number;
  version: number;
};

export type LoadedPathway = Pathway & {
  pathwayVersionId: string | null;
  leaderGuide: LeaderGuide | null;
  challengePool: ChallengePool | null;
  source: 'remote' | 'local';
  theme: RawPathwayTheme | null;
};

type PathwayCache = Record<
  string,
  {
    pathway: Pathway;
    leaderGuide: LeaderGuide | null;
    challengePool: ChallengePool | null;
    cachedAt: string;
  }
>;

type ThemeCache = Record<string, { version: number; theme: RawPathwayTheme }>;

const localPathway = pathwayData as Pathway;

function pathwayIdFromLocalVersion(pathwayVersionId: string | null) {
  const id = pathwayVersionId?.startsWith('local:') ? pathwayVersionId.slice(6) : DEFAULT_PATHWAY_ID;
  return BUNDLED_PATHWAYS[id] ? id : DEFAULT_PATHWAY_ID;
}

function localFallback(pathwayVersionId: string | null = null, pathwayId?: string): LoadedPathway {
  const id =
    pathwayId && BUNDLED_PATHWAYS[pathwayId] ? pathwayId : pathwayIdFromLocalVersion(pathwayVersionId);
  const bundled = BUNDLED_PATHWAYS[id];
  return {
    ...bundled.pathway,
    id,
    pathwayVersionId,
    leaderGuide: bundled.leaderGuide,
    challengePool: bundled.challengePool,
    source: 'local',
    theme: BUNDLED_THEMES[id] ?? null,
  };
}

async function cachedTheme(pathwayId: string): Promise<RawPathwayTheme | null> {
  const cache = await readJson<ThemeCache>(THEME_CACHE_KEY, {});
  return cache[pathwayId]?.theme ?? BUNDLED_THEMES[pathwayId] ?? null;
}

const isNonEmptyTheme = (v: unknown): v is RawPathwayTheme => isNonEmptyObject(v);

/**
 * `pathway_versions.resources` (migration 003). Missing column or empty → bundled copy for
 * this pathway, so guide pages still show before the migration runs.
 */
async function loadResources(pathwayVersionId: string, pathwayId: string): Promise<PathwayResource[]> {
  const bundled = BUNDLED_PATHWAYS[pathwayId]?.pathway.resources ?? [];
  if (!supabase) return bundled;
  const { data, error } = await supabase
    .from('pathway_versions')
    .select('resources')
    .eq('id', pathwayVersionId)
    .maybeSingle();
  if (error || !Array.isArray(data?.resources) || data.resources.length === 0) return bundled;
  return data.resources as PathwayResource[];
}

/**
 * Stored theme first; only downloads `pathways.theme` when `theme_version` is newer
 * than the stored copy. Any failure (offline, column missing) keeps the stored/bundled theme.
 */
async function loadPathwayTheme(pathwayId: string): Promise<RawPathwayTheme | null> {
  if (!isRemoteConfigured || !supabase) return cachedTheme(pathwayId);
  const cache = await readJson<ThemeCache>(THEME_CACHE_KEY, {});
  const stored = cache[pathwayId];
  const fallback = stored?.theme ?? BUNDLED_THEMES[pathwayId] ?? null;
  try {
    const { data: meta, error } = await supabase
      .from('pathways')
      .select('theme_version')
      .eq('id', pathwayId)
      .maybeSingle();
    if (error) throw error;
    const remoteVersion = (meta?.theme_version as number | undefined) ?? 0;
    if (remoteVersion === 0 || stored?.version === remoteVersion) return fallback;

    const { data, error: themeErr } = await supabase
      .from('pathways')
      .select('theme')
      .eq('id', pathwayId)
      .maybeSingle();
    if (themeErr) throw themeErr;
    if (!isNonEmptyTheme(data?.theme)) return fallback;

    await writeJson(THEME_CACHE_KEY, {
      ...cache,
      [pathwayId]: { version: remoteVersion, theme: data.theme },
    });
    return data.theme;
  } catch {
    return fallback;
  }
}

function rowToWeek(row: {
  week_number: number;
  title: string;
  movement: string | null;
  week_type: string;
  content: Record<string, unknown>;
}): PathwayWeek {
  return {
    weekNumber: row.week_number,
    title: row.title,
    movement: row.movement ?? '',
    type: row.week_type as PathwayWeek['type'],
    ...row.content,
  } as PathwayWeek;
}

export async function listAvailablePathways(): Promise<PathwayOption[]> {
  if (isRemoteConfigured && supabase) {
    const { data, error } = await supabase.from('pathways_available').select('*');
    if (!error && data && data.length > 0) {
      return data.map((row) => ({
        pathwayId: row.pathway_id as string,
        pathwayVersionId: row.pathway_version_id as string,
        name: row.name as string,
        description: (row.description as string) ?? '',
        totalWeeks: row.total_weeks as number,
        version: row.version as number,
      }));
    }
  }

  return Object.entries(BUNDLED_PATHWAYS).map(([pathwayId, { pathway }]) => ({
    pathwayId,
    pathwayVersionId: localVersionId(pathwayId),
    name: pathway.name,
    description: pathway.description,
    totalWeeks: pathway.totalWeeks,
    version: 1,
  }));
}

export async function loadPathwayByVersionId(
  pathwayVersionId: string | null | undefined,
  pathwayId?: string | null
): Promise<LoadedPathway> {
  if (isLocalVersionId(pathwayVersionId)) {
    return localFallback(pathwayVersionId ?? null);
  }
  if (!pathwayVersionId) return localFallback(null);

  // Cache first for offline
  const cache = await readJson<PathwayCache>(CACHE_KEY, {});
  const cached = cache[pathwayVersionId];

  if (isRemoteConfigured && supabase) {
    try {
      const { data: version, error: vErr } = await supabase
        .from('pathway_versions')
        .select('id, pathway_id, version, total_weeks, leader_guide, challenge_pool')
        .eq('id', pathwayVersionId)
        .maybeSingle();
      if (vErr) throw vErr;
      if (!version) throw new Error('Pathway version not found');

      const { data: pathwayMeta } = await supabase
        .from('pathways')
        .select('name, description')
        .eq('id', version.pathway_id)
        .maybeSingle();

      const { data: weeks, error: wErr } = await supabase
        .from('pathway_weeks')
        .select('week_number, title, movement, week_type, content')
        .eq('pathway_version_id', pathwayVersionId)
        .order('week_number', { ascending: true });
      if (wErr) throw wErr;

      const bundled = BUNDLED_PATHWAYS[version.pathway_id];
      const loaded: LoadedPathway = {
        id: version.pathway_id,
        name: pathwayMeta?.name ?? version.pathway_id,
        description: pathwayMeta?.description ?? '',
        totalWeeks: version.total_weeks,
        weeks: (weeks ?? []).map(rowToWeek),
        resources: await loadResources(pathwayVersionId, version.pathway_id),
        pathwayVersionId,
        leaderGuide: isNonEmptyObject(version.leader_guide)
          ? (version.leader_guide as LeaderGuide)
          : (bundled?.leaderGuide ?? null),
        challengePool: isNonEmptyObject(version.challenge_pool)
          ? (version.challenge_pool as ChallengePool)
          : (bundled?.challengePool ?? null),
        source: 'remote',
        theme: await loadPathwayTheme(version.pathway_id),
      };

      await writeJson(CACHE_KEY, {
        ...cache,
        [pathwayVersionId]: {
          pathway: {
            id: loaded.id,
            name: loaded.name,
            description: loaded.description,
            totalWeeks: loaded.totalWeeks,
            weeks: loaded.weeks,
            resources: loaded.resources,
          },
          leaderGuide: loaded.leaderGuide,
          challengePool: loaded.challengePool,
          cachedAt: new Date().toISOString(),
        },
      });

      return loaded;
    } catch (e) {
      if (cached) {
        return {
          ...cached.pathway,
          pathwayVersionId,
          leaderGuide: cached.leaderGuide,
          challengePool: cached.challengePool,
          source: 'local',
          theme: await cachedTheme(cached.pathway.id),
        };
      }
      console.warn('Remote pathway load failed, using bundled content', e);
      return localFallback(pathwayVersionId, pathwayId ?? undefined);
    }
  }

  if (cached) {
    return {
      ...cached.pathway,
      pathwayVersionId,
      leaderGuide: cached.leaderGuide,
      challengePool: cached.challengePool,
      source: 'local',
      theme: await cachedTheme(cached.pathway.id),
    };
  }

  return localFallback(pathwayVersionId, pathwayId ?? undefined);
}

export function getWeekFromPathway(pathway: Pathway, weekNumber: number): PathwayWeek {
  const week = pathway.weeks.find((w) => w.weekNumber === weekNumber);
  if (!week) {
    throw new Error(`Week ${weekNumber} not found`);
  }
  return week;
}

export function isGroupChallengeWeek(
  week: PathwayWeek
): week is Extract<PathwayWeek, { type: 'groupChallenge' }> {
  return week.type === 'groupChallenge';
}

export function isStandardWeek(week: PathwayWeek): week is StandardWeek {
  return week.type === 'standard';
}

export function progressItemIdsForWeek(week: StandardWeek): string[] {
  return [
    ...week.challenges.map((c) => c.id),
    ...(week.soap ?? []).map((s) => s.id),
    ...(week.journaling ?? []).map((j) => j.id),
    ...(week.careForTheBody ? [week.careForTheBody.id] : []),
  ];
}

/** Checkmarks done vs. possible; a `chooseOne` challenge counts once, done if any option is. */
export function weekCompletion(week: StandardWeek, completedIds: ReadonlySet<string>) {
  const others = progressItemIdsForWeek(week).filter(
    (id) => !week.challenges.some((c) => c.id === id)
  );
  const challengeDone = week.challenges.filter((c) => completedIds.has(c.id)).length;
  const challenge =
    week.challengeMode === 'chooseOne'
      ? { done: Math.min(challengeDone, 1), total: week.challenges.length ? 1 : 0 }
      : { done: challengeDone, total: week.challenges.length };
  return {
    done: challenge.done + others.filter((id) => completedIds.has(id)).length,
    total: challenge.total + others.length,
  };
}

/** Whether the Study tab has anything to show for this week / pathway. */
export function hasStudyContent(week: PathwayWeek | null, resources: PathwayResource[] | undefined) {
  const study = week && isStandardWeek(week) ? week.study : undefined;
  return Boolean(study?.article?.length || study?.quotes?.length || study?.definition || resources?.length);
}

/** @deprecated Prefer useContent() — kept for any sync call sites during transition */
export const pathway = localFallback(null);
export const challengePool = challengePoolData;
export const leaderGuide = leaderGuideData;
export const PATHWAY_OPTIONS = [
  {
    id: DEFAULT_PATHWAY_ID,
    name: localPathway.name,
    description: localPathway.description,
    totalWeeks: localPathway.totalWeeks,
  },
];

export function getWeek(weekNumber: number): PathwayWeek {
  return getWeekFromPathway(localPathway, weekNumber);
}
