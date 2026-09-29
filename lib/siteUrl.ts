import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

/** Public web address. Per-deploy *.vercel.app URLs sit behind Vercel login, so email links must never use them. */
export const SITE_URL = (
  process.env.EXPO_PUBLIC_SITE_URL?.trim() || 'https://for-the-king-test.vercel.app'
).replace(/\/+$/, '');

function isLocalWeb() {
  return (
    typeof window !== 'undefined' &&
    /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname)
  );
}

/** Where links in auth emails (confirm sign-up, reset password) should send the user. */
export function authRedirectUrl(path: string) {
  if (Platform.OS !== 'web' || isLocalWeb()) return Linking.createURL(path);
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
