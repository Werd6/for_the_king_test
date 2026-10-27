import type { TextStyle } from 'react-native';
import { goAndMakeFonts, systemFonts, type FontSet } from '@/lib/fonts';

/** Go and Make palette: Paper #F7F5F0, Stone #E6E2D9, Ink #292C29, Sage #607666, Clay #AE7757. */

export type ColorScheme = 'light' | 'dark';
export type ThemePreference = 'system' | ColorScheme;

export type ThemeColors = {
  bg: string;
  surface: string;
  surfaceStrong: string;
  primary: string;
  /** Decorative highlight (focus rings, logo rule). Not used for text. */
  accent: string;
  muted: string;
  /** Secondary text; muted fails 4.5:1 contrast on the light background. */
  mutedText: string;
  ink: string;
  onPrimary: string;
  danger: string;
  border: string;
  inputBg: string;
  white: string;
};

/** Light: Paper canvas, Ink text, Sage actions, Clay highlights. */
export const lightColors: ThemeColors = {
  bg: '#F7F5F0',
  surface: '#FCFBF8',
  surfaceStrong: '#E6E2D9',
  primary: '#607666',
  accent: '#AE7757',
  muted: '#8C8F88',
  mutedText: '#5F625C',
  ink: '#292C29',
  onPrimary: '#FFFFFF',
  danger: '#9B3B2E',
  border: '#D9D4C9',
  inputBg: '#FFFFFF',
  white: '#FFFFFF',
};

/** Dark: Ink canvas, Paper text, lightened Sage and Clay so they read on dark. */
export const darkColors: ThemeColors = {
  bg: '#1F211F',
  surface: '#292C29',
  surfaceStrong: '#3A3E3A',
  primary: '#8FA595',
  accent: '#C48E6E',
  muted: '#7D817A',
  mutedText: '#B3AFA6',
  ink: '#F7F5F0',
  onPrimary: '#292C29',
  danger: '#E0826F',
  border: '#3A3E3A',
  inputBg: '#242624',
  white: '#FFFFFF',
};

/** @deprecated Prefer useTheme().colors — kept as light default for static imports */
export const colors = lightColors;

export function getColors(scheme: ColorScheme): ThemeColors {
  return scheme === 'dark' ? darkColors : lightColors;
}

export type Spacing = { xs: number; sm: number; md: number; lg: number; xl: number; xxl: number };
export type Radii = { sm: number; md: number; lg: number };

export const spacing: Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 48,
};

export const radii: Radii = {
  sm: 6,
  md: 8,
  lg: 12,
};

export type FontThemeName = 'go-and-make' | 'system';

function makeTypography(fonts: FontSet, serifDisplay: boolean) {
  return {
    title: serifDisplay
      ? { ...fonts.display, fontSize: 30, lineHeight: 36 }
      : { ...fonts.display, fontSize: 22, lineHeight: 28 },
    subtitle: { ...fonts.semibold, fontSize: 16, lineHeight: 22 },
    section: { ...fonts.bold, fontSize: 17, lineHeight: 22 },
    body: { ...fonts.regular, fontSize: 15, lineHeight: 22 },
    label: { ...fonts.semibold, fontSize: 14, lineHeight: 18 },
    button: { ...fonts.bold, fontSize: 16, lineHeight: 20 },
    /** Scripture and quote blocks. */
    quote: serifDisplay
      ? { ...fonts.display, fontSize: 20, lineHeight: 27 }
      : { ...fonts.regular, fontSize: 15, lineHeight: 24 },
  } satisfies Record<string, TextStyle>;
}

export type Typography = ReturnType<typeof makeTypography>;

export const fontThemes: Record<FontThemeName, { fonts: FontSet; typography: Typography }> = {
  'go-and-make': { fonts: goAndMakeFonts, typography: makeTypography(goAndMakeFonts, true) },
  system: { fonts: systemFonts, typography: makeTypography(systemFonts, false) },
};
