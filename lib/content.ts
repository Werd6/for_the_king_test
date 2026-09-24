import pathwayData from '@/content/pathway.json';
import challengePoolData from '@/content/challenge-pool.json';
import leaderGuideData from '@/content/leader-guide.json';
import { isRemoteConfigured, readJson, supabase, writeJson } from '@/lib/supabase';
import type { Pathway, PathwayWeek, StandardWeek } from '@/lib/types';

const CACHE_KEY = 'ftk.pathwayCache';

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
  leaderGuide: typeof leaderGuideData;
  challengePool: typeof challengePoolData;
  source: 'remote' | 'local';
};

type PathwayCache = Record<
  string,
  {
    pathway: Pathway;
    leaderGuide: typeof leaderGuideData;
    challengePool: typeof challengePoolData;
    cachedAt: string;
  }
>;

const localPathway = pathwayData as Pathway;

function localFallback(pathwayVersionId: string | null = null): LoadedPathway {
  return {
    ...localPathway,
    id: 'for-the-king',
    pathwayVersionId,
    leaderGuide: leaderGuideData,
    challengePool: challengePoolData,
    source: 'local',
  };
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

  return [
    {
      pathwayId: 'for-the-king',
      pathwayVersionId: 'local',
      name: localPathway.name,
      description: localPathway.description,
      totalWeeks: localPathway.totalWeeks,
      version: 1,
    },
  ];
}

export async function loadPathwayByVersionId(
  pathwayVersionId: string | null | undefined
): Promise<LoadedPathway> {
  if (!pathwayVersionId || pathwayVersionId === 'local') {
    return localFallback(pathwayVersionId ?? null);
  }

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

      const loaded: LoadedPathway = {
        id: version.pathway_id,
        name: pathwayMeta?.name ?? version.pathway_id,
        description: pathwayMeta?.description ?? '',
        totalWeeks: version.total_weeks,
        weeks: (weeks ?? []).map(rowToWeek),
        pathwayVersionId,
        leaderGuide: (version.leader_guide as typeof leaderGuideData) ?? leaderGuideData,
        challengePool: (version.challenge_pool as typeof challengePoolData) ?? challengePoolData,
        source: 'remote',
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
        };
      }
      console.warn('Remote pathway load failed, using bundled content', e);
      return localFallback(pathwayVersionId);
    }
  }

  if (cached) {
    return {
      ...cached.pathway,
      pathwayVersionId,
      leaderGuide: cached.leaderGuide,
      challengePool: cached.challengePool,
      source: 'local',
    };
  }

  return localFallback(pathwayVersionId);
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
    ...week.journaling.map((j) => j.id),
    week.careForTheBody.id,
  ];
}

/** @deprecated Prefer useContent() — kept for any sync call sites during transition */
export const pathway = localFallback(null);
export const challengePool = challengePoolData;
export const leaderGuide = leaderGuideData;
export const PATHWAY_OPTIONS = [
  {
    id: 'for-the-king',
    name: localPathway.name,
    description: localPathway.description,
    totalWeeks: localPathway.totalWeeks,
  },
];

export function getWeek(weekNumber: number): PathwayWeek {
  return getWeekFromPathway(localPathway, weekNumber);
}
