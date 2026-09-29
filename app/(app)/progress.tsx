import {
  Body,
  Card,
  ErrorState,
  FeedbackLink,
  Loading,
  Screen,
  Section,
  SettingsGroup,
  SettingsRow,
  Subtitle,
  Title,
} from '@/components/ui';
import { advanceWeek, getHuddleMembers, getProgressForWeek, getWeekPick } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { isGroupChallengeWeek, isStandardWeek, weekChecklist, weekCompletion } from '@/lib/content';
import { useContent } from '@/lib/ContentContext';
import { confirmAction, showAlert } from '@/lib/dialogs';
import { friendlyError } from '@/lib/errors';
import { typography } from '@/lib/theme';
import { useTheme } from '@/lib/ThemeContext';
import type { Profile, ProgressRow, StandardWeek, WeekPick } from '@/lib/types';
import { useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

function WeekProgressModal({
  huddleId,
  weekNumber,
  members,
  onClose,
}: {
  huddleId: string;
  weekNumber: number | null;
  members: Profile[];
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const { pathway, getWeek } = useContent();
  const [rows, setRows] = useState<ProgressRow[]>([]);
  const [pick, setPick] = useState<WeekPick | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // Keeps content on screen while the modal animates closed.
  const [shownWeek, setShownWeek] = useState<number | null>(null);

  const load = useCallback(
    async (n: number) => {
      setLoading(true);
      setError(null);
      try {
        const [p, wp] = await Promise.all([getProgressForWeek(huddleId, n), getWeekPick(huddleId, n)]);
        setRows(p);
        setPick(wp);
      } catch (e) {
        setError(friendlyError(e, 'Could not load progress.'));
      } finally {
        setLoading(false);
      }
    },
    [huddleId]
  );

  useEffect(() => {
    if (weekNumber == null) return;
    setShownWeek(weekNumber);
    setCollapsed(new Set());
    load(weekNumber);
  }, [weekNumber, load]);

  const week = shownWeek != null && pathway ? getWeek(shownWeek) : null;

  function body() {
    if (!week) return null;
    if (error) return <ErrorState message={error} onRetry={() => shownWeek != null && load(shownWeek)} />;
    if (loading) return <Loading />;
    if (isGroupChallengeWeek(week)) {
      const selected = week.options.find((o) => o.id === pick?.option_id);
      return (
        <Card title="Group activity">
          <Body>
            {selected ? `Selected: ${selected.text}` : 'No activity was selected for this week.'}
          </Body>
          <Body>Group weeks don’t have individual checkmarks.</Body>
        </Card>
      );
    }
    if (!isStandardWeek(week)) return null;
    return members.map((m) => (
      <MemberProgress
        key={m.id}
        name={m.display_name}
        week={week}
        completed={new Set(rows.filter((r) => r.user_id === m.id).map((r) => r.item_id))}
        expanded={!collapsed.has(m.id)}
        onToggle={() =>
          setCollapsed((prev) => {
            const next = new Set(prev);
            if (next.has(m.id)) next.delete(m.id);
            else next.add(m.id);
            return next;
          })
        }
      />
    ));
  }

  return (
    <Modal
      visible={weekNumber != null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.bg }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Text style={{ ...typography.section, color: colors.ink, flex: 1 }} accessibilityRole="header">
            Week {shownWeek} progress
          </Text>
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={12}>
            <Text style={{ ...typography.button, color: colors.primary }}>Done</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ gap: 12, padding: 16, paddingBottom: 48 }}>
          {week ? (
            <>
              <Subtitle>{week.title}</Subtitle>
              {week.movement ? <Body>{week.movement}</Body> : null}
              <Body>View only. Members can only change their own checkmarks for the current week.</Body>
            </>
          ) : null}
          {body()}
        </ScrollView>
      </SafeAreaView>
    </Modal>
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
  const [weekMenuOpen, setWeekMenuOpen] = useState(false);
  const [viewWeek, setViewWeek] = useState<number | null>(null);

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
  const pastWeeks = pathway.weeks.filter((w) => w.weekNumber <= huddle.current_week);
  const leaderTools = isLeader ? (
    <>
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
        <SettingsRow
          label="View progress"
          value={weekMenuOpen ? 'Choose a week' : undefined}
          onPress={() => setWeekMenuOpen((open) => !open)}
        />
        {weekMenuOpen
          ? pastWeeks.map((w) => (
              <SettingsRow
                key={w.weekNumber}
                label={`Week ${w.weekNumber}${w.weekNumber === huddle.current_week ? ' (current)' : ''}`}
                value={w.title}
                onPress={() => setViewWeek(w.weekNumber)}
              />
            ))
          : null}
      </SettingsGroup>
      <WeekProgressModal
        huddleId={huddle.id}
        weekNumber={viewWeek}
        members={members}
        onClose={() => setViewWeek(null)}
      />
    </>
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
          <FeedbackLink />
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
        <FeedbackLink />
      </ScrollView>
    </Screen>
  );
}
