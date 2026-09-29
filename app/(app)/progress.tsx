import { Body, ErrorState, Loading, Screen, Section, SettingsGroup, SettingsRow, Title } from '@/components/ui';
import { advanceWeek, getHuddleMembers, getProgressForWeek } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { isStandardWeek, weekCompletion } from '@/lib/content';
import { useContent } from '@/lib/ContentContext';
import { confirmAction, showAlert } from '@/lib/dialogs';
import { friendlyError } from '@/lib/errors';
import { useTheme } from '@/lib/ThemeContext';
import type { Profile, ProgressRow } from '@/lib/types';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, Text } from 'react-native';

export default function ProgressScreen() {
  const { huddle, userId, isLeader, refresh } = useAuth();
  const { getWeek, loading: contentLoading, pathway, reloadForHuddle } = useContent();
  const { colors } = useTheme();
  const router = useRouter();
  const [members, setMembers] = useState<Profile[]>([]);
  const [progress, setProgress] = useState<ProgressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!huddle) return;
    setLoading(true);
    try {
      const [m, p] = await Promise.all([
        getHuddleMembers(huddle.id),
        getProgressForWeek(huddle.id, huddle.current_week),
      ]);
      setMembers(m);
      setProgress(p);
      setLoadError(null);
    } catch (e) {
      setLoadError(friendlyError(e, 'Could not load progress.'));
    } finally {
      setLoading(false);
    }
  }, [huddle]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onAdvance() {
    if (!huddle || !userId) return;
    const ok = await confirmAction(
      'Advance to next week?',
      'Everyone will see the next week’s content.',
      'Advance'
    );
    if (!ok) return;
    try {
      await advanceWeek(huddle.id, userId, pathway?.totalWeeks ?? 20);
      await refresh();
      await reloadForHuddle();
      showAlert('Week advanced', `Now on week ${huddle.current_week + 1}.`);
    } catch (e) {
      showAlert('Error', friendlyError(e, 'Could not advance'));
    }
  }

  if (!huddle) return <Loading />;
  if (loadError) return <ErrorState message={loadError} onRetry={load} />;
  if (loading || contentLoading || !pathway) return <Loading />;

  const week = getWeek(huddle.current_week);
  const leaderTools = isLeader ? (
    <SettingsGroup label="Leader">
      <SettingsRow label="Advance to next week" onPress={onAdvance} />
      <SettingsRow
        label="Leader materials"
        onPress={() => router.push('/(app)/leader-materials')}
      />
      {pathway.leaderGuide ? (
        <SettingsRow label="Leader guide" onPress={() => router.push('/(app)/leader-guide')} />
      ) : null}
      {pathway.challengePool ? (
        <SettingsRow label="Challenge pool" onPress={() => router.push('/(app)/challenge-pool')} />
      ) : null}
    </SettingsGroup>
  ) : null;

  if (!isStandardWeek(week)) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 40 }}>
          <Title>Huddle Progress</Title>
          <Body>
            Week {week.weekNumber} is a group challenge. Progress checkmarks resume on standard
            weeks. See This Week for the selected activity.
          </Body>
          {leaderTools}
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 40 }}>
        <Title>Huddle Progress</Title>
        <Body>
          Week {week.weekNumber}: {week.title}.
        </Body>

        <Section title="Members">
          {members.map((m) => {
            const { done, total } = weekCompletion(
              week,
              new Set(progress.filter((p) => p.user_id === m.id).map((p) => p.item_id))
            );
            return (
              <Text
                key={m.id}
                style={{ fontSize: 16, marginBottom: 8, color: colors.ink, lineHeight: 22 }}
              >
                {m.display_name}: {done}/{total}
              </Text>
            );
          })}
        </Section>

        {leaderTools}
      </ScrollView>
    </Screen>
  );
}
