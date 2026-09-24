/** Coolors palette: https://coolors.co/dee5e5-9dc5bb-17b890-5e807f-082d0f */

export type ColorScheme = 'light' | 'dark';
export type ThemePreference = 'system' | ColorScheme;

export type ThemeColors = {
  bg: string;
  surface: string;
  surfaceStrong: string;
  primary: string;
  muted: string;
  ink: string;
  onPrimary: string;
  danger: string;
  border: string;
  inputBg: string;
  white: string;
};

/** Light — Coolors as specified */
export const lightColors: ThemeColors = {
  bg: '#DEE5E5',
  surface: '#E8EEEE',
  surfaceStrong: '#9DC5BB',
  primary: '#17B890',
  muted: '#5E807F',
  ink: '#082D0F',
  onPrimary: '#082D0F',
  danger: '#8B1E1E',
  border: '#5E807F',
  inputBg: '#F4F7F7',
  white: '#FFFFFF',
};

/**
 * Dark — same family inverted:
 * forest ink becomes the canvas; mint/platinum become text & accents.
 */
export const darkColors: ThemeColors = {
  bg: '#082D0F',
  surface: '#0F3A1C',
  surfaceStrong: '#5E807F',
  primary: '#17B890',
  muted: '#9DC5BB',
  ink: '#DEE5E5',
  onPrimary: '#082D0F',
  danger: '#E07070',
  border: '#5E807F',
  inputBg: '#0C2A16',
  white: '#FFFFFF',
};

/** @deprecated Prefer useTheme().colors — kept as light default for static imports */
export const colors = lightColors;

export function getColors(scheme: ColorScheme): ThemeColors {
  return scheme === 'dark' ? darkColors : lightColors;
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 48,
} as const;

export const radii = {
  sm: 6,
  md: 8,
  lg: 12,
} as const;

export const typography = {
  title: { fontSize: 22, fontWeight: '700' as const, lineHeight: 28 },
  subtitle: { fontSize: 16, fontWeight: '600' as const, lineHeight: 22 },
  section: { fontSize: 17, fontWeight: '700' as const, lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  label: { fontSize: 14, fontWeight: '600' as const, lineHeight: 18 },
  button: { fontSize: 16, fontWeight: '700' as const, lineHeight: 20 },
} as const;

export const theme = {
  colors: lightColors,
  spacing,
  radii,
  typography,
} as const;

export type Theme = typeof theme;
