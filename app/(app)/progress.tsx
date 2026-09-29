import { Body, ErrorState, Loading, Screen, Section, SettingsGroup, SettingsRow, Title } from '@/components/ui';
import { advanceWeek, getHuddleMembers, getProgressForWeek } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { isStandardWeek, weekChecklist, weekCompletion } from '@/lib/content';
import { useContent } from '@/lib/ContentContext';
import { confirmAction, showAlert } from '@/lib/dialogs';
import { friendlyError } from '@/lib/errors';
import { typography } from '@/lib/theme';
import { useTheme } from '@/lib/ThemeContext';
import type { Profile, ProgressRow, StandardWeek } from '@/lib/types';
import { useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

function MemberProgress({
  name,
  week,
  completed,
  expanded,
  onToggle,
}: {
  name: string;
  week: StandardWeek;
  completed: ReadonlySet<string>;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { colors, radii } = useTheme();
  const { done, total } = weekCompletion(week, completed);

  return (
    <View
      style={{
        marginBottom: 8,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        overflow: 'hidden',
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${name}, ${done} of ${total} done`}
        onPress={onToggle}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingVertical: 12,
          paddingHorizontal: 14,
          opacity: pressed ? 0.75 : 1,
        })}
      >
        <Text style={{ ...typography.subtitle, color: colors.ink, flex: 1 }}>{name}</Text>
        <Text style={{ ...typography.label, color: colors.mutedText }}>
          {done}/{total}
        </Text>
        <SymbolView
          name={{
            ios: expanded ? 'chevron.up' : 'chevron.down',
            android: expanded ? 'expand_less' : 'expand_more',
            web: expanded ? 'expand_less' : 'expand_more',
          }}
          tintColor={colors.mutedText}
          size={20}
        />
      </Pressable>

      {expanded ? (
        <View
          style={{
            gap: 12,
            paddingHorizontal: 14,
            paddingTop: 12,
            paddingBottom: 14,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          {weekChecklist(week).map((group) => (
            <View key={group.title} style={{ gap: 6 }}>
              <Text style={{ ...typography.label, color: colors.mutedText }}>{group.title}</Text>
              {group.items.map((item) => {
                const isDone = completed.has(item.id);
                return (
                  <View
                    key={item.id}
                    accessible
                    accessibilityLabel={`${item.text}: ${isDone ? 'done' : 'not done'}`}
                    style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        marginTop: 1,
                        borderRadius: radii.sm,
                        borderWidth: 2,
                        borderColor: isDone ? colors.primary : colors.muted,
                        backgroundColor: isDone ? colors.primary : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isDone ? (
                        <Text style={{ color: colors.onPrimary, fontSize: 12, fontWeight: '800' }}>✓</Text>
                      ) : null}
                    </View>
                    <Text
                      style={{
                        ...typography.body,
                        flex: 1,
                        color: isDone ? colors.ink : colors.mutedText,
                      }}
                    >
                      {item.text}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default function ProgressScreen() {
  const { huddle, userId, isLeader, refresh } = useAuth();
  const { getWeek, loading: contentLoading, pathway, reloadForHuddle } = useContent();
  const router = useRouter();
  const [members, setMembers] = useState<Profile[]>([]);
  const [progress, setProgress] = useState<ProgressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
          <Body>Tap a name to see each item.</Body>
          {members.map((m) => (
            <MemberProgress
              key={m.id}
              name={m.display_name}
              week={week}
              completed={new Set(progress.filter((p) => p.user_id === m.id).map((p) => p.item_id))}
              expanded={expandedId === m.id}
              onToggle={() => setExpandedId(expandedId === m.id ? null : m.id)}
            />
          ))}
        </Section>

        {leaderTools}
      </ScrollView>
    </Screen>
  );
}
