import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * Web: follow prefers-color-scheme (RN web often reports incorrectly / SSR-safe).
 * Falls back to RN's hook when media query isn't available.
 */
export function useColorScheme(): 'light' | 'dark' {
  const rn = useRNColorScheme();
  const [scheme, setScheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return rn === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      setScheme(rn === 'dark' ? 'dark' : 'light');
      return;
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => setScheme(mq.matches ? 'dark' : 'light');
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, [rn]);

  return scheme;
}
