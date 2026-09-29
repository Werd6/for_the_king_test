import ftkTheme from '@/content/theme.json';
import pc3Theme from '@/content/pathways/pc3-focuses/theme.json';
import type { RawPathwayTheme } from '@/lib/pathwayTheme';

/**
 * Image files referenced by name from a theme JSON (For The King: `content/assets/`,
 * other pathways: `content/pathways/<id>/assets/`). File names must be unique across pathways.
 * Published themes embed these as data URIs; bundled themes resolve them here.
 */
export const BUNDLED_THEME_ASSETS: Record<string, number> = {
  'for-the-king-logo.png': require('@/content/assets/for-the-king-logo.png'),
  'for-the-king-logo-dark.png': require('@/content/assets/for-the-king-logo-dark.png'),
  'for-the-king-favicon.png': require('@/content/assets/for-the-king-favicon.png'),
  'pc3-logo.png': require('@/content/pathways/pc3-focuses/assets/pc3-logo.png'),
  'pc3-favicon.png': require('@/content/pathways/pc3-focuses/assets/pc3-favicon.png'),
};

/** Themes shipped with the app, used before/without a published theme. Keyed by pathway id. */
export const BUNDLED_THEMES: Record<string, RawPathwayTheme> = {
  'for-the-king': ftkTheme,
  'pc3-focuses': pc3Theme,
};
