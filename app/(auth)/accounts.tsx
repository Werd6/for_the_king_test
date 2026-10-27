import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Body, Loading, PrimaryButton, Screen, SecondaryButton, Title } from '@/components/ui';
import { PathwayLogo } from '@/components/PathwayLogo';
import { useAuth } from '@/lib/AuthContext';
import { friendlyError } from '@/lib/errors';
import { useTheme } from '@/lib/ThemeContext';

export default function AccountsScreen() {
  const { userId, savedAccounts, switchAccount, loading } = useAuth();
  const { colors, typography, radii, spacing } = useTheme();
  const router = useRouter();
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failedAccount, setFailedAccount] = useState<(typeof savedAccounts)[number] | null>(null);
  const busy = loading || switchingId !== null;

  /** Drops the previous account's screens from the stack. */
  function goHome() {
    if (router.canDismiss()) router.dismissAll();
    router.replace('/');
  }

  async function chooseAccount(accountId: string) {
    if (busy) return;
    setError(null);
    setFailedAccount(null);
    if (accountId === userId) {
      goHome();
      return;
    }
    setSwitchingId(accountId);
    try {
      await switchAccount(accountId);
      goHome();
    } catch (e) {
      setError(friendlyError(e, 'Could not switch accounts. Try again or sign in again.'));
      setFailedAccount(savedAccounts.find((account) => account.userId === accountId) ?? null);
    } finally {
      setSwitchingId(null);
    }
  }

  if (loading && !switchingId) return <Loading />;

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Swap Account', headerBackVisible: !busy, gestureEnabled: !busy }} />
      <ScrollView contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xxl }}>
        <PathwayLogo height={36} />
        <Title>Swap account</Title>
        <Body>{Platform.OS === 'web'
          ? 'Choose a huddle account or add another. Your saved accounts stay signed in on this browser.'
          : 'Choose a huddle account or add another. You can receive notifications from every account signed in on this device.'}</Body>

        {savedAccounts.length === 0 ? (
          <Body>No accounts are signed in on this device yet.</Body>
        ) : savedAccounts.map((account) => {
          const current = account.userId === userId;
          const switching = account.userId === switchingId;
          const identity = account.displayName || account.email || 'Account';
          const huddle = account.huddleName
            ? `${account.huddleName} · ${account.isLeader ? 'Leader' : 'Member'}`
            : 'No huddle yet';
          return (
            <Pressable
              key={account.userId}
              accessibilityRole="button"
              accessibilityLabel={`${identity}${account.email ? `, ${account.email}` : ''}, ${huddle}${current ? ', current account' : ''}`}
              accessibilityState={{ disabled: busy, selected: current, busy: switching }}
              disabled={busy}
              onPress={() => chooseAccount(account.userId)}
              style={({ pressed }) => ({
                backgroundColor: pressed ? colors.surfaceStrong : colors.surface,
                borderColor: current ? colors.primary : colors.border,
                borderWidth: current ? 2 : 1,
                borderRadius: radii.lg,
                padding: spacing.lg,
                gap: spacing.xs,
                opacity: busy && !switching ? 0.55 : 1,
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Text style={{ ...typography.subtitle, color: colors.ink, flex: 1 }}>{identity}</Text>
                {switching ? <ActivityIndicator color={colors.primary} /> : null}
                {current ? <Text style={{ ...typography.label, color: colors.primary }}>Current</Text> : null}
              </View>
              {account.email ? <Text style={{ ...typography.body, color: colors.mutedText }}>{account.email}</Text> : null}
              <Text style={{ ...typography.body, color: colors.ink }}>{huddle}</Text>
              {switching ? <Text accessibilityLiveRegion="polite" style={{ ...typography.label, color: colors.mutedText }}>Switching…</Text> : null}
            </Pressable>
          );
        })}

        {error ? <Text accessibilityRole="alert" style={{ ...typography.body, color: colors.danger }}>{error}</Text> : null}
        {failedAccount ? (
          <SecondaryButton
            title="Sign in again"
            disabled={busy}
            onPress={() => router.push({
              pathname: '/(auth)/sign-in',
              params: { addAccount: '1', email: failedAccount.email ?? '' },
            })}
          />
        ) : null}
        <PrimaryButton
          title="Add account"
          disabled={busy}
          onPress={() => router.push({ pathname: '/(auth)/sign-in', params: { addAccount: '1' } })}
        />
        <SecondaryButton
          title={userId ? 'Back to current account' : 'Back to sign in'}
          disabled={busy}
          onPress={goHome}
        />
      </ScrollView>
    </Screen>
  );
}
