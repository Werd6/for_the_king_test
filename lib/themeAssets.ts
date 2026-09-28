import ftkTheme from '@/content/theme.json';
import type { RawPathwayTheme } from '@/lib/pathwayTheme';

/**
 * Files in `content/assets/` referenced by name from a theme JSON.
 * Published themes embed these as data URIs; bundled themes resolve them here.
 */
export const BUNDLED_THEME_ASSETS: Record<string, number> = {
  'for-the-king-logo.png': require('@/content/assets/for-the-king-logo.png'),
  'for-the-king-logo-dark.png': require('@/content/assets/for-the-king-logo-dark.png'),
  'for-the-king-favicon.png': require('@/content/assets/for-the-king-favicon.png'),
};

/** Themes shipped with the app, used before/without a published theme. Keyed by pathway id. */
export const BUNDLED_THEMES: Record<string, RawPathwayTheme> = {
  'for-the-king': ftkTheme,
};
