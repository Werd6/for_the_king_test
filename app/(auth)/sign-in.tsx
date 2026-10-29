import { useEffect, useState } from 'react';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Alert, Platform, ScrollView, Text } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Body, FeedbackLink, Field, PrimaryButton, Screen, SecondaryButton, Title } from '@/components/ui';
import { requestPasswordReset } from '@/lib/api';
import { PathwayLogo } from '@/components/PathwayLogo';
import { useAuth } from '@/lib/AuthContext';
import { friendlyError } from '@/lib/errors';
import { authRedirectUrl } from '@/lib/siteUrl';
import { signInWithApple } from '@/lib/socialAuth';
import { useTheme } from '@/lib/ThemeContext';

function showMessage(title: string, message: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

export default function SignInScreen() {
  const { signIn, signUp, usingLocalMode, userId, huddle, refresh, savedAccounts } = useAuth();
  const { colors, fonts, radii, scheme, spacing } = useTheme();
  const router = useRouter();
  // Swap account → Add account: sign in to another account while staying signed in.
  const params = useLocalSearchParams<{ addAccount?: string; email?: string }>();
  const addingAccount = params.addAccount === '1';
  const [mode, setMode] = useState<'in' | 'up'>(addingAccount ? 'in' : 'up');
  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userId && !addingAccount) {
      router.replace('/');
    }
  }, [userId, addingAccount, router]);

  if (!addingAccount && userId && huddle) return <Redirect href="/(app)/(tabs)" />;
  if (!addingAccount && userId) return <Redirect href="/(onboarding)/join-create" />;

  /** Drops the previous account's screens when adding an account. */
  function goHome() {
    if (router.canDismiss()) router.dismissAll();
    router.replace('/');
  }

  async function submit() {
    setError(null);
    if (!email.trim() || !password.trim()) {
      const msg = 'Email and password are required.';
      setError(msg);
      showMessage('Missing fields', msg);
      return;
    }
    if (mode === 'up' && !displayName.trim()) {
      const msg = 'Enter the name your group will see.';
      setError(msg);
      showMessage('Display name required', msg);
      return;
    }
    setBusy(true);
    try {
      if (mode === 'up') {
        await signUp(email.trim(), password, displayName.trim());
      } else {
        await signIn(email.trim(), password);
      }
      goHome();
    } catch (e) {
      const msg = friendlyError(e, 'Something went wrong');
      setError(msg);
      showMessage('Auth', msg);
      // If account was created but needs email confirm, switch to sign-in
      if (msg.toLowerCase().includes('check your email')) {
        setMode('in');
      }
    } finally {
      setBusy(false);
    }
  }

  async function forgotPassword() {
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      const msg = 'Enter your email above, then tap Forgot password.';
      setError(msg);
      return;
    }
    setBusy(true);
    try {
      await requestPasswordReset(trimmed, authRedirectUrl('/reset-password'));
      showMessage(
        'Check your email',
        `If an account exists for ${trimmed}, we sent a link to reset your password.`
      );
    } catch (e) {
      const msg = friendlyError(e, 'Could not send reset email');
      setError(msg);
      showMessage('Reset password', msg);
    } finally {
      setBusy(false);
    }
  }

  async function socialApple() {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await signInWithApple();
      await refresh();
      goHome();
    } catch (e) {
      const msg = friendlyError(e, 'Something went wrong');
      setError(msg);
      showMessage('Auth', msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 40 }}>
        <PathwayLogo height={64} />
        <Title>{addingAccount ? 'Add account' : 'Go and Make'}</Title>
        {addingAccount ? (
          <Body>
            Sign in to another account. Your other accounts stay signed in on this device, and you can
            swap between them in Settings.
          </Body>
        ) : (
          <Body>Your discipleship huddle companion.</Body>
        )}
        {addingAccount ? null : usingLocalMode ? (
          <Body>Sign up or sign in to get started. Data stays on this device until cloud sync is configured.</Body>
        ) : (
          <Body>Sign up or sign in with email to sync your huddle across devices.</Body>
        )}

        {mode === 'up' ? (
          <Field
            label="Display name"
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
            placeholder="Your name"
            autoComplete="name"
            textContentType="name"
          />
        ) : null}
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@email.com"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
          autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
          textContentType={mode === 'up' ? 'newPassword' : 'password'}
        />
        {mode === 'in' && !usingLocalMode ? (
          <Text
            accessibilityRole="link"
            onPress={busy ? undefined : forgotPassword}
            style={{
              ...fonts.regular,
              color: colors.mutedText,
              textDecorationLine: 'underline',
              alignSelf: 'flex-end',
            }}
          >
            Forgot password?
          </Text>
        ) : null}

        {error ? (
          <Text style={{ ...fonts.regular, color: colors.danger, marginBottom: 4 }}>{error}</Text>
        ) : null}

        <PrimaryButton
          title={busy ? 'Please wait…' : mode === 'up' ? 'Create account' : 'Sign in'}
          onPress={submit}
          disabled={busy}
        />
        <SecondaryButton
          title={mode === 'up' ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
          onPress={() => {
            setError(null);
            setMode(mode === 'up' ? 'in' : 'up');
          }}
        />

        {!usingLocalMode && Platform.OS === 'ios' ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={
              scheme === 'dark'
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={radii.md}
            onPress={socialApple}
            style={{ height: 48, marginVertical: spacing.xs, opacity: busy ? 0.5 : 1 }}
          />
        ) : null}

        {addingAccount ? (
          <SecondaryButton title="Cancel" onPress={() => router.back()} disabled={busy} />
        ) : savedAccounts.length ? (
          <SecondaryButton
            title="Choose a saved account"
            onPress={() => router.push('/(auth)/accounts')}
            disabled={busy}
          />
        ) : null}

        <FeedbackLink />
      </ScrollView>
    </Screen>
  );
}
