import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme as useSystemColorScheme } from '@/components/useColorScheme';
import {
  ColorScheme,
  ThemeColors,
  ThemePreference,
  getColors,
} from '@/lib/theme';

const STORAGE_KEY = 'ftk_theme_preference';

type ThemeContextValue = {
  preference: ThemePreference;
  scheme: ColorScheme;
  colors: ThemeColors;
  setPreference: (next: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useSystemColorScheme();
  const systemScheme: ColorScheme = system === 'dark' ? 'dark' : 'light';
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (typeof window === 'undefined') return;
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && (raw === 'light' || raw === 'dark' || raw === 'system')) {
          setPreferenceState(raw);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    if (typeof window !== 'undefined') {
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
    }
  }, []);

  const scheme: ColorScheme =
    preference === 'system' ? systemScheme : preference;

  const colors = useMemo(() => getColors(scheme), [scheme]);

  const value = useMemo(
    () => ({ preference, scheme, colors, setPreference }),
    [preference, scheme, colors, setPreference]
  );

  // Avoid flashing wrong scheme before storage loads — still render with system default
  void hydrated;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
