import ftkTheme from '@/content/theme.json';
import type { RawPathwayTheme } from '@/lib/pathwayTheme';
import { WEB_ONLY_THEME_ASSETS, WEB_ONLY_THEMES } from '@/lib/webOnlyContent';

/**
 * Image files referenced by name from a theme JSON (For The King pathway: `content/assets/`,
 * other pathways: `content/pathways/<id>/assets/`). File names must be unique across pathways.
 * Published themes embed these as data URIs; bundled themes resolve them here.
 */
export const BUNDLED_THEME_ASSETS: Record<string, number> = {
  'go-and-make-logo.png': require('@/assets/images/go-and-make-logo.png'),
  'for-the-king-logo.png': require('@/content/assets/for-the-king-logo.png'),
  'for-the-king-logo-dark.png': require('@/content/assets/for-the-king-logo-dark.png'),
  'for-the-king-favicon.png': require('@/content/assets/for-the-king-favicon.png'),
  ...WEB_ONLY_THEME_ASSETS,
};

/** Themes shipped with the app, used before/without a published theme. Keyed by pathway id. */
export const BUNDLED_THEMES: Record<string, RawPathwayTheme> = {
  'for-the-king': ftkTheme,
  ...WEB_ONLY_THEMES,
};
