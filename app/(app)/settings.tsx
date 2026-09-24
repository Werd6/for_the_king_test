import { useState } from 'react';
import { ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Body,
  Field,
  Loading,
  Screen,
  SettingsGroup,
  SettingsInset,
  SettingsRow,
  SettingsSegmented,
  Title,
} from '@/components/ui';
import {
  advanceWeek,
  deleteAccount,
  dissolveHuddle,
  leaveHuddle,
  updateDisplayName,
} from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { useContent } from '@/lib/ContentContext';
import { syncHuddleMeetingsToDevice } from '@/lib/calendar';
import { confirmAction, shareText, showAlert } from '@/lib/dialogs';
import { useTheme } from '@/lib/ThemeContext';
import type { ThemePreference } from '@/lib/theme';

export default function SettingsScreen() {
  const { userId, profile, huddle, isLeader, refresh, signOut, usingLocalMode } = useAuth();
  const { pathway, reloadForHuddle } = useContent();
  const { preference, setPreference } = useTheme();
  const router = useRouter();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [busy, setBusy] = useState(false);

  if (!userId || !profile || !huddle) return <Loading />;

  const nameDirty = name.trim() !== (profile.display_name ?? '');
  const contentLabel = usingLocalMode
    ? 'Local mode'
    : pathway?.source === 'remote'
      ? 'Cloud content'
      : 'Bundled content';

  async function saveName() {
    setBusy(true);
    try {
      await updateDisplayName(userId!, name.trim() || profile!.display_name);
      await refresh();
      showAlert('Saved', 'Display name updated.');
    } catch (e) {
      showAlert('Error', e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  async function shareCode() {
    try {
      await shareText(`Join my For The King huddle with code ${huddle!.invite_code}`);
    } catch (e) {
      showAlert('Share failed', e instanceof Error ? e.message : 'Could not share');
    }
  }

  async function onAdvance() {
    const ok = await confirmAction(
      'Advance to next week?',
      'Everyone will see the next week’s content.',
      'Advance'
    );
    if (!ok) return;
    try {
      await advanceWeek(huddle!.id, userId!, pathway?.totalWeeks ?? 20);
      await refresh();
      await reloadForHuddle();
      showAlert('Week advanced', `Now on week ${huddle!.current_week + 1}.`);
    } catch (e) {
      showAlert('Error', e instanceof Error ? e.message : 'Could not advance');
    }
  }

  async function onLeave() {
    const ok = await confirmAction(
      'Leave huddle?',
      'You will need a new invite code to rejoin.',
      'Leave'
    );
    if (!ok) return;
    try {
      await leaveHuddle(userId!);
      await refresh();
      router.replace('/');
    } catch (e) {
      showAlert('Error', e instanceof Error ? e.message : 'Could not leave');
    }
  }

  async function onDissolve() {
    const ok = await confirmAction(
      'Dissolve huddle?',
      'This removes the huddle for everyone.',
      'Dissolve'
    );
    if (!ok) return;
    try {
      await dissolveHuddle(huddle!.id);
      await refresh();
      router.replace('/');
    } catch (e) {
      showAlert('Error', e instanceof Error ? e.message : 'Could not dissolve');
    }
  }

  async function onSyncCalendar() {
    try {
      const n = await syncHuddleMeetingsToDevice(huddle!);
      showAlert('Calendar', n ? 'Meeting added to your calendar.' : 'Set a meeting time first.');
    } catch (e) {
      showAlert('Calendar error', e instanceof Error ? e.message : 'Failed');
    }
  }

  async function onDeleteAccount() {
    const ok = await confirmAction(
      'Delete account?',
      'This removes your local/account data. Required for App Store compliance.',
      'Delete'
    );
    if (!ok) return;
    try {
      await deleteAccount(userId!);
      await refresh();
      router.replace('/');
    } catch (e) {
      showAlert('Error', e instanceof Error ? e.message : 'Could not delete');
    }
  }

  const appearanceOptions: { id: ThemePreference; label: string }[] = [
    { id: 'system', label: 'System' },
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
  ];

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 4, paddingBottom: 48 }}>
        <Title>Settings</Title>
        <Body>
          {huddle.name} · Week {huddle.current_week} of {pathway?.totalWeeks ?? '—'} · {contentLabel}
        </Body>

        <SettingsGroup label="Appearance">
          <SettingsSegmented
            options={appearanceOptions}
            value={preference}
            onChange={setPreference}
          />
        </SettingsGroup>

        <SettingsGroup label="Profile">
          <SettingsInset>
            <Field
              label="Display name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </SettingsInset>
          {nameDirty ? (
            <SettingsRow
              label={busy ? 'Saving…' : 'Save name'}
              onPress={saveName}
              showChevron={false}
            />
          ) : null}
        </SettingsGroup>

        <SettingsGroup label="Invite" footer="Brothers join with this code.">
          <SettingsRow label="Invite code" value={huddle.invite_code} showChevron={false} />
          <SettingsRow label="Share invite" onPress={shareCode} />
        </SettingsGroup>

        <SettingsGroup label="Meetings">
          <SettingsRow label="Meeting time & location" onPress={() => router.push('/(app)/meetings')} />
          <SettingsRow label="Add to device calendar" onPress={onSyncCalendar} />
        </SettingsGroup>

        {isLeader ? (
          <SettingsGroup label="Leader">
            <SettingsRow label="Advance to next week" onPress={onAdvance} />
            <SettingsRow
              label="Leader materials"
              onPress={() => router.push('/(app)/leader-materials')}
            />
            <SettingsRow label="Leader guide" onPress={() => router.push('/(app)/leader-guide')} />
            <SettingsRow
              label="Challenge pool"
              onPress={() => router.push('/(app)/challenge-pool')}
            />
            <SettingsRow label="Dissolve huddle" onPress={onDissolve} destructive />
          </SettingsGroup>
        ) : (
          <SettingsGroup label="Membership">
            <SettingsRow label="Leave huddle" onPress={onLeave} destructive />
          </SettingsGroup>
        )}

        <SettingsGroup
          label="Account"
          footer="We store account, huddle membership, and checkmarks only — not journal or prayer text."
        >
          <SettingsRow label="Sign out" onPress={() => signOut()} showChevron={false} />
          <SettingsRow label="Delete account" onPress={onDeleteAccount} destructive />
        </SettingsGroup>
      </ScrollView>
    </Screen>
  );
}
