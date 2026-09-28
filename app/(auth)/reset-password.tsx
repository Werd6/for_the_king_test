import { Body, Field, Loading, PrimaryButton, Screen, Title } from '@/components/ui';
import { updatePassword } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { showAlert } from '@/lib/dialogs';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/ThemeContext';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, Text } from 'react-native';

type Status = { kind: 'verifying' } | { kind: 'ready' } | { kind: 'invalid'; message: string };

const MIN_PASSWORD_LENGTH = 6;

/** Supabase puts recovery tokens in the URL hash (implicit flow) or `code` query (PKCE). */
function parseAuthParams(url: string) {
  const params = new URLSearchParams();
  const [beforeHash, hash = ''] = url.split('#');
  const query = beforeHash.split('?')[1] ?? '';
  for (const part of [query, hash]) {
    new URLSearchParams(part).forEach((value, key) => params.set(key, value));
  }
  return params;
}

function clearWebUrl() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.history.replaceState(null, '', window.location.pathname);
  }
}

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { refresh } = useAuth();
  const { colors } = useTheme();
  const nativeUrl = Linking.useURL();
  const url = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : nativeUrl;
  const consumedRef = useRef(false);

  const [status, setStatus] = useState<Status>({ kind: 'verifying' });
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || consumedRef.current) return;
    const client = supabase;
    let cancelled = false;

    (async () => {
      const params = url ? parseAuthParams(url) : new URLSearchParams();
      const linkError = params.get('error_description');
      if (linkError) {
        consumedRef.current = true;
        clearWebUrl();
        setStatus({ kind: 'invalid', message: linkError.replace(/\+/g, ' ') });
        return;
      }

      try {
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const code = params.get('code');
        if (accessToken && refreshToken) {
          consumedRef.current = true;
          const { error: sessionErr } = await client.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionErr) throw sessionErr;
          clearWebUrl();
        } else if (code) {
          consumedRef.current = true;
          const { error: codeErr } = await client.auth.exchangeCodeForSession(code);
          if (codeErr) throw codeErr;
          clearWebUrl();
        }

        const { data } = await client.auth.getSession();
        if (cancelled) return;
        if (data.session) {
          setStatus({ kind: 'ready' });
        } else if (url) {
          setStatus({
            kind: 'invalid',
            message: 'This reset link is invalid or has expired. Request a new one from sign in.',
          });
        }
      } catch (e) {
        if (!cancelled) {
          setStatus({ kind: 'invalid', message: friendlyError(e, 'This reset link has expired.') });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

  async function submit() {
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('Passwords don’t match.');
      return;
    }
    setBusy(true);
    try {
      await updatePassword(password);
      await refresh();
      showAlert('Password updated', 'You’re signed in with your new password.');
      router.replace('/');
    } catch (e) {
      setError(friendlyError(e, 'Could not update password.'));
    } finally {
      setBusy(false);
    }
  }

  if (!supabase) {
    return (
      <Screen>
        <Title>Reset password</Title>
        <Body>Password reset is only available with cloud sync.</Body>
      </Screen>
    );
  }

  if (status.kind === 'verifying') return <Loading />;

  if (status.kind === 'invalid') {
    return (
      <Screen>
        <Title>Reset link expired</Title>
        <Body>{status.message}</Body>
        <PrimaryButton title="Back to sign in" onPress={() => router.replace('/(auth)/sign-in')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 40 }}>
        <Title>Choose a new password</Title>
        <Field
          label="New password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <Field
          label="Confirm new password"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
        />
        {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
        <PrimaryButton
          title={busy ? 'Saving…' : 'Update password'}
          onPress={submit}
          disabled={busy}
        />
      </ScrollView>
    </Screen>
  );
}
