import type { ImageSourcePropType } from 'react-native';
import {
  darkColors,
  lightColors,
  radii as defaultRadii,
  spacing as defaultSpacing,
  type ColorScheme,
  type Radii,
  type Spacing,
  type ThemeColors,
} from '@/lib/theme';
import { BUNDLED_THEME_ASSETS } from '@/lib/themeAssets';

/** Theme JSON as authored in `content/theme.json` / stored in `pathways.theme`. */
export type RawPathwayTheme = {
  light?: Partial<ThemeColors>;
  dark?: Partial<ThemeColors>;
  radii?: Partial<Radii>;
  spacingScale?: number;
  /** Data URI, https URL, or a file name in `content/assets/`. */
  logo?: string;
  logoDark?: string;
  favicon?: string;
  tabTitle?: string;
  /** Name of an alternate app icon bundled in the native build. */
  iconKey?: string;
};

export type ThemeImage = ImageSourcePropType;

export type ResolvedTheme = {
  colors: Record<ColorScheme, ThemeColors>;
  radii: Radii;
  spacing: Spacing;
  logo: Record<ColorScheme, ThemeImage | null>;
  favicon: ThemeImage | null;
  tabTitle: string | null;
  iconKey: string | null;
};

export const DEFAULT_THEME: ResolvedTheme = {
  colors: { light: lightColors, dark: darkColors },
  radii: defaultRadii,
  spacing: defaultSpacing,
  logo: {
    light: BUNDLED_THEME_ASSETS['for-the-king-logo.png'] ?? null,
    dark: BUNDLED_THEME_ASSETS['for-the-king-logo-dark.png'] ?? null,
  },
  favicon: null,
  tabTitle: null,
  iconKey: null,
};

const HEX = /^#[0-9a-f]{6}$/i;
const MIN_CONTRAST = 4.5;

/** Text/background pairs that must stay readable, or the palette falls back to the default. */
const CONTRAST_PAIRS: [keyof ThemeColors, keyof ThemeColors][] = [
  ['ink', 'bg'],
  ['ink', 'surface'],
  ['mutedText', 'bg'],
  ['onPrimary', 'primary'],
];

function channel(hex: string, offset: number) {
  const c = parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
}

export function contrastRatio(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

function resolvePalette(raw: unknown, fallback: ThemeColors, label: string): ThemeColors {
  if (!isObject(raw)) return fallback;
  const merged: ThemeColors = { ...fallback };
  for (const key of Object.keys(fallback) as (keyof ThemeColors)[]) {
    const value = raw[key];
    if (typeof value === 'string' && HEX.test(value)) merged[key] = value;
  }
  for (const [fg, bg] of CONTRAST_PAIRS) {
    const ratio = contrastRatio(merged[fg], merged[bg]);
    if (ratio < MIN_CONTRAST) {
      console.warn(`Theme ${label}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1; using default palette.`);
      return fallback;
    }
  }
  return merged;
}

function resolveRadii(raw: unknown): Radii {
  if (!isObject(raw)) return defaultRadii;
  const out = { ...defaultRadii };
  for (const key of Object.keys(defaultRadii) as (keyof Radii)[]) {
    const v = raw[key];
    if (typeof v === 'number' && v >= 0 && v <= 32) out[key] = v;
  }
  return out;
}

function resolveSpacing(scale: unknown): Spacing {
  if (typeof scale !== 'number' || !Number.isFinite(scale)) return defaultSpacing;
  const s = Math.min(1.5, Math.max(0.75, scale));
  const out = { ...defaultSpacing };
  for (const key of Object.keys(out) as (keyof Spacing)[]) {
    out[key] = Math.round(defaultSpacing[key] * s);
  }
  return out;
}

function resolveImage(value: unknown): ThemeImage | null {
  if (typeof value !== 'string' || !value) return null;
  if (value.startsWith('data:image/') || value.startsWith('https://')) return { uri: value };
  return BUNDLED_THEME_ASSETS[value] ?? null;
}

function resolveText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** Merges a raw theme over the default. Anything missing or invalid falls back. */
export function resolveTheme(raw: unknown): ResolvedTheme {
  if (!isObject(raw)) return DEFAULT_THEME;
  const customLight = resolveImage(raw.logo);
  const customDark = resolveImage(raw.logoDark) ?? customLight;
  return {
    colors: {
      light: resolvePalette(raw.light, lightColors, 'light'),
      dark: resolvePalette(raw.dark, darkColors, 'dark'),
    },
    radii: resolveRadii(raw.radii),
    spacing: resolveSpacing(raw.spacingScale),
    logo: {
      light: customLight ?? DEFAULT_THEME.logo.light,
      dark: customDark ?? DEFAULT_THEME.logo.dark,
    },
    favicon: resolveImage(raw.favicon),
    tabTitle: resolveText(raw.tabTitle),
    iconKey: resolveText(raw.iconKey),
  };
}
