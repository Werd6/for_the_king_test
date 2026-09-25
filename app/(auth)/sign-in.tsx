import { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, Text } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Body, Field, PrimaryButton, Screen, Title } from '@/components/ui';
import { useAuth } from '@/lib/AuthContext';
import { openFeedbackForm } from '@/lib/feedback';
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
  const { signIn, signUp, usingLocalMode, userId, huddle, refresh } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const [mode, setMode] = useState<'in' | 'up'>('up');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userId) {
      router.replace('/');
    }
  }, [userId, router]);

  if (userId && huddle) return <Redirect href="/(app)" />;
  if (userId) return <Redirect href="/(onboarding)/join-create" />;

  async function submit() {
    setError(null);
    if (!email.trim() || !password.trim()) {
      const msg = 'Email and password are required.';
      setError(msg);
      showMessage('Missing fields', msg);
      return;
    }
    if (mode === 'up' && !displayName.trim()) {
      const msg = 'Enter the name your brothers will see.';
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
      router.replace('/');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong';
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

  async function socialApple() {
    setError(null);
    setBusy(true);
    try {
      await signInWithApple();
      await refresh();
      router.replace('/');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong';
      setError(msg);
      showMessage('Auth', msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 40 }}>
        <Title>For The King</Title>
        <Body>Men’s discipleship huddle companion.</Body>
        {usingLocalMode ? (
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
          />
        ) : null}
        <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@email.com" />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
        />

        {error ? (
          <Text style={{ color: colors.danger, marginBottom: 4 }}>{error}</Text>
        ) : null}

        <PrimaryButton
          title={busy ? 'Please wait…' : mode === 'up' ? 'Create account' : 'Sign in'}
          onPress={submit}
          disabled={busy}
        />
        <PrimaryButton
          title={mode === 'up' ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
          onPress={() => {
            setError(null);
            setMode(mode === 'up' ? 'in' : 'up');
          }}
        />

        {!usingLocalMode && Platform.OS === 'ios' ? (
          <PrimaryButton title="Sign in with Apple" onPress={socialApple} disabled={busy} />
        ) : null}

        <Text
          accessibilityRole="link"
          onPress={openFeedbackForm}
          style={{ color: colors.muted, textAlign: 'center', marginTop: 12, textDecorationLine: 'underline' }}
        >
          Found a bug or have a suggestion? Send feedback
        </Text>
      </ScrollView>
    </Screen>
  );
}
