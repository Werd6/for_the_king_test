import type { RawPathwayTheme } from '@/lib/pathwayTheme';
import type { Pathway } from '@/lib/types';

/** iPhone and Android builds bundle no web-only pathways; see webOnlyContent.web.ts. */
export const WEB_ONLY_PATHWAYS: Record<string, Pathway> = {};

export const WEB_ONLY_THEMES: Record<string, RawPathwayTheme> = {};

export const WEB_ONLY_THEME_ASSETS: Record<string, number> = {};
