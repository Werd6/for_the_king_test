import { useCallback, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Body, Loading, Screen, Section, Title } from '@/components/ui';
import { getHuddleMembers, getProgressForWeek } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { useContent } from '@/lib/ContentContext';
import { isStandardWeek, progressItemIdsForWeek } from '@/lib/content';
import { useTheme } from '@/lib/ThemeContext';
import type { Profile, ProgressRow } from '@/lib/types';

export default function ProgressScreen() {
  const { huddle } = useAuth();
  const { getWeek, loading: contentLoading, pathway } = useContent();
  const { colors } = useTheme();
  const [members, setMembers] = useState<Profile[]>([]);
  const [progress, setProgress] = useState<ProgressRow[]>([]);
  const [loading, setLoading] = useState(true);

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
    } finally {
      setLoading(false);
    }
  }, [huddle]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!huddle) return <Loading />;
  if (loading || contentLoading || !pathway) return <Loading />;

  const week = getWeek(huddle.current_week);

  if (!isStandardWeek(week)) {
    return (
      <Screen>
        <Title>Huddle Progress</Title>
        <Body>
          Week {week.weekNumber} is a group challenge. Progress checkmarks resume on standard weeks.
          See This Week for the selected activity.
        </Body>
      </Screen>
    );
  }

  const itemIds = progressItemIdsForWeek(week);
  const total = itemIds.length;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 40 }}>
        <Title>Huddle Progress</Title>
        <Body>
          Week {week.weekNumber}: {week.title}. Shared checkmarks only — no journal or prayer text.
        </Body>

        <Section title="Brothers">
          {members.map((m) => {
            const done = progress.filter(
              (p) => p.user_id === m.id && itemIds.includes(p.item_id)
            ).length;
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
      </ScrollView>
    </Screen>
  );
}
