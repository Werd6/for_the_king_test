import pc3PathwayData from '@/content/pathways/pc3-focuses/pathway.json';
import pc3Theme from '@/content/pathways/pc3-focuses/theme.json';
import type { RawPathwayTheme } from '@/lib/pathwayTheme';
import type { Pathway } from '@/lib/types';

/**
 * Pathways bundled into the web app only. The iPhone and Android builds use
 * webOnlyContent.ts, which is empty, so none of this content ships in them.
 */
export const WEB_ONLY_PATHWAYS: Record<string, Pathway> = {
  'pc3-focuses': pc3PathwayData as Pathway,
};

export const WEB_ONLY_THEMES: Record<string, RawPathwayTheme> = {
  'pc3-focuses': pc3Theme,
};

export const WEB_ONLY_THEME_ASSETS: Record<string, number> = {
  'pc3-logo.png': require('@/content/pathways/pc3-focuses/assets/pc3-logo.png'),
  'pc3-favicon.png': require('@/content/pathways/pc3-focuses/assets/pc3-favicon.png'),
};
