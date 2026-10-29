import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Auth email links (reset password) that open the native app. The router navigates on the
 * link before the target screen mounts, so a screen-level listener misses it when the app
 * was already running; this module listens from app start instead. Import it from the root
 * layout so the listener exists before the first link arrives.
 */
let latest: string | null = null;
const listeners = new Set<(url: string | null) => void>();

function isAuthLink(url: string) {
  return /[?#&](access_token|code|error_description)=/.test(url);
}

function record(url: string | null) {
  if (!url || !isAuthLink(url)) return;
  latest = url;
  listeners.forEach((listener) => listener(url));
}

if (Platform.OS !== 'web') {
  Linking.getInitialURL().then(record);
  Linking.addEventListener('url', ({ url }) => record(url));
}

/** The latest auth link that opened the app, or null. Always null on web. */
export function useAuthLinkUrl(): string | null {
  const [url, setUrl] = useState(latest);
  useEffect(() => {
    listeners.add(setUrl);
    setUrl(latest);
    return () => {
      listeners.delete(setUrl);
    };
  }, []);
  return url;
}

/** Forget the stored link once its tokens are used, so a later visit doesn't reuse them. */
export function clearAuthLinkUrl() {
  latest = null;
}
