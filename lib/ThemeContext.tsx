import AsyncStorage from '@react-native-async-storage/async-storage';
import { Asset } from 'expo-asset';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useColorScheme as useSystemColorScheme } from '@/components/useColorScheme';
import { applyAppIcon } from '@/lib/appIcon';
import { resolveTheme, type RawPathwayTheme, type ThemeImage } from '@/lib/pathwayTheme';
import type { ColorScheme, Radii, Spacing, ThemeColors, ThemePreference } from '@/lib/theme';

const PREFERENCE_KEY = 'ftk_theme_preference';
/** Last applied pathway theme, so launches start in the right look before content loads. */
const ACTIVE_THEME_KEY = 'ftk.activeTheme';
const DEFAULT_TAB_TITLE = 'For The King';

type ThemeContextValue = {
  preference: ThemePreference;
  scheme: ColorScheme;
  colors: ThemeColors;
  radii: Radii;
  spacing: Spacing;
  logo: ThemeImage | null;
  tabTitle: string;
  setPreference: (next: ThemePreference) => void;
  /** Called by content loading with the huddle's pathway theme, or null for the default. */
  setPathwayTheme: (theme: RawPathwayTheme | null) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function imageUri(image: ThemeImage | null): string | null {
  if (!image) return null;
  if (typeof image === 'number') return Asset.fromModule(image).uri;
  if (!Array.isArray(image) && typeof image === 'object' && image.uri) return image.uri;
  return null;
}

function useWebDocumentBranding(favicon: ThemeImage | null, title: string, bg: string) {
  const defaultFaviconRef = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    if (defaultFaviconRef.current === null) defaultFaviconRef.current = link.href || '/favicon.ico';
    link.href = imageUri(favicon) ?? defaultFaviconRef.current;

    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = bg;
  }, [favicon, bg]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.title = title;
    // Expo Router rewrites the title on navigation; keep the pathway title.
    const titleEl = document.querySelector('title');
    if (!titleEl) return;
    const observer = new MutationObserver(() => {
      if (document.title !== title) document.title = title;
    });
    observer.observe(titleEl, { childList: true });
    return () => observer.disconnect();
  }, [title]);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useSystemColorScheme();
  const systemScheme: ColorScheme = system === 'dark' ? 'dark' : 'light';
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [rawTheme, setRawTheme] = useState<RawPathwayTheme | null>(null);
  /** True once content loading has chosen a theme (not just the stored one from last launch). */
  const [themeSettled, setThemeSettled] = useState(false);
  const settledRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    (async () => {
      try {
        const [pref, stored] = await Promise.all([
          AsyncStorage.getItem(PREFERENCE_KEY),
          AsyncStorage.getItem(ACTIVE_THEME_KEY),
        ]);
        if (cancelled) return;
        if (pref === 'light' || pref === 'dark' || pref === 'system') setPreferenceState(pref);
        if (stored && !settledRef.current) setRawTheme(JSON.parse(stored) as RawPathwayTheme);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    if (typeof window !== 'undefined') {
      AsyncStorage.setItem(PREFERENCE_KEY, next).catch(() => {});
    }
  }, []);

  const setPathwayTheme = useCallback((theme: RawPathwayTheme | null) => {
    settledRef.current = true;
    setThemeSettled(true);
    setRawTheme(theme);
    if (typeof window === 'undefined') return;
    const write = theme
      ? AsyncStorage.setItem(ACTIVE_THEME_KEY, JSON.stringify(theme))
      : AsyncStorage.removeItem(ACTIVE_THEME_KEY);
    write.catch(() => {});
  }, []);

  const resolved = useMemo(() => resolveTheme(rawTheme), [rawTheme]);
  const scheme: ColorScheme = preference === 'system' ? systemScheme : preference;
  const colors = resolved.colors[scheme];
  const tabTitle = resolved.tabTitle ?? DEFAULT_TAB_TITLE;

  useWebDocumentBranding(resolved.favicon, tabTitle, colors.bg);

  useEffect(() => {
    // Only after content loading decides, so launches don't flip the icon back and forth.
    if (themeSettled) applyAppIcon(resolved.iconKey);
  }, [themeSettled, resolved.iconKey]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      scheme,
      colors,
      radii: resolved.radii,
      spacing: resolved.spacing,
      logo: resolved.logo[scheme],
      tabTitle,
      setPreference,
      setPathwayTheme,
    }),
    [preference, scheme, colors, resolved, tabTitle, setPreference, setPathwayTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
