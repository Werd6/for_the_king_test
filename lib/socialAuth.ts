import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';
import { isRemoteConfigured, supabase } from '@/lib/supabase';

/**
 * Sign in with Apple — requires:
 * - Expo Apple Authentication plugin (configured in app.json)
 * - Apple provider enabled in Supabase Auth
 * - Real device / TestFlight for full flow
 */
export async function signInWithApple(): Promise<void> {
  if (!isRemoteConfigured || !supabase) {
    throw new Error('Configure Supabase before using Apple Sign In.');
  }
  if (Platform.OS !== 'ios') {
    throw new Error('Sign in with Apple is only available on iOS.');
  }

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) {
    throw new Error('No identity token from Apple.');
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });
  if (error) throw error;

  if (credential.fullName?.givenName) {
    const display =
      [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean).join(' ') ||
      'Brother';
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        display_name: display,
        email: data.user.email,
      });
    }
  }
}

/**
 * Google Sign In — disabled for this prototype (no UI entry point).
 */
export async function signInWithGoogle(): Promise<void> {
  throw new Error('Google sign-in is disabled for this prototype.');
}
