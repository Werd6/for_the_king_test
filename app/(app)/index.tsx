import {
  Body,
  BulletList,
  Card,
  CheckboxRow,
  ErrorState,
  FeedbackLink,
  Loading,
  PrimaryButton,
  Screen,
  SecondaryButton,
  Subtitle,
  Title,
} from '@/components/ui';
import { PathwayLogo } from '@/components/PathwayLogo';
import { StudyBlocks } from '@/components/StudyBlocks';
import { getProgressForWeek, getWeekPick, setProgress, setWeekPick } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { friendlyError } from '@/lib/errors';
import { isGroupChallengeWeek, isStandardWeek } from '@/lib/content';
import { useContent } from '@/lib/ContentContext';
import { showAlert } from '@/lib/dialogs';
import { useTheme } from '@/lib/ThemeContext';
import type { ProgressRow } from '@/lib/types';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

export default function WeekHomeScreen() {
  const { huddle, userId, isLeader, refresh } = useAuth();
  const { getWeek, pathway, loading: contentLoading } = useContent();
  const { colors } = useTheme();
  const router = useRouter();
  const [progress, setProgressRows] = useState<ProgressRow[]>([]);
  const [pickId, setPickId] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!huddle) return;
      if (!opts?.silent) setInitialLoading(true);
      try {
        const rows = await getProgressForWeek(huddle.id, huddle.current_week);
        setProgressRows(rows);
        const pick = await getWeekPick(huddle.id, huddle.current_week);
        setPickId(pick?.option_id ?? null);
        setLoadError(null);
      } catch (e) {
        if (opts?.silent) throw e;
        setLoadError(friendlyError(e, 'Could not load this week.'));
      } finally {
        if (!opts?.silent) setInitialLoading(false);
      }
    },
    [huddle]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!huddle || !userId) return <Loading />;
  if (loadError) return <ErrorState message={loadError} onRetry={() => load()} />;
  if (initialLoading || contentLoading || !pathway) return <Loading />;

  const week = getWeek(huddle.current_week);
  const totalWeeks = pathway.totalWeeks;
  const myCompleted = new Set(
    progress.filter((p) => p.user_id === userId).map((p) => p.item_id)
  );

  async function toggle(itemId: string, next: boolean) {
    if (!huddle || !userId) return;

    // Optimistic UI — don't remount the whole screen
    setProgressRows((prev) => {
      const without = prev.filter(
        (p) => !(p.user_id === userId && p.item_id === itemId && p.week === huddle.current_week)
      );
      if (!next) return without;
      return [
        ...without,
        {
          id: `temp-${itemId}`,
          huddle_id: huddle.id,
          user_id: userId,
          week: huddle.current_week,
          item_id: itemId,
          completed_at: new Date().toISOString(),
        },
      ];
    });

    setSavingId(itemId);
    try {
      await setProgress({
        huddleId: huddle.id,
        userId,
        week: huddle.current_week,
        itemId,
        completed: next,
      });
      await load({ silent: true });
    } catch (e) {
      await load({ silent: true });
      showAlert('Error', friendlyError(e, 'Could not update'));
    } finally {
      setSavingId(null);
    }
  }

  async function pickOption(optionId: string) {
    if (!huddle || !userId || !isLeader) return;
    try {
      await setWeekPick({
        huddleId: huddle.id,
        week: huddle.current_week,
        optionId,
        leaderId: userId,
      });
      await load({ silent: true });
      await refresh();
    } catch (e) {
      showAlert('Error', friendlyError(e, 'Could not pick'));
    }
  }

  if (isGroupChallengeWeek(week)) {
    const selected = week.options.find((o) => o.id === pickId);
    return (
      <Screen>
        <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 48 }}>
          <PathwayLogo />
          <Title>
            Week {week.weekNumber} of {totalWeeks}
          </Title>
          <Subtitle>{week.title}</Subtitle>
          <Text style={{ fontWeight: '600', color: colors.ink }}>{week.movement}</Text>
          <Body>This week replaces the normal huddle with a shared group activity.</Body>
          {isLeader ? (
            <PrimaryButton
              title="Leader Materials"
              onPress={() => router.push('/(app)/leader-materials')}
            />
          ) : null}

          <Card title="Group activity">
            {selected ? (
              <Body>Selected: {selected.text}</Body>
            ) : (
              <Body>No activity selected yet. The leader picks one at the meeting.</Body>
            )}
            {week.options.map((opt) => (
              <View key={opt.id} style={{ marginBottom: 8 }}>
                {isLeader ? (
                  <PrimaryButton
                    title={`${pickId === opt.id ? '✓ ' : ''}${opt.text}`}
                    onPress={() => pickOption(opt.id)}
                  />
                ) : (
                  <Body>
                    {pickId === opt.id ? '✓ ' : '• '}
                    {opt.text}
                  </Body>
                )}
              </View>
            ))}
            {!isLeader ? (
              <Body>Only the huddle leader can lock in the group activity.</Body>
            ) : (
              <Body>Meeting prompts (Before You Go, prayer, etc.) are in Leader Materials.</Body>
            )}
          </Card>
          <FeedbackLink />
        </ScrollView>
      </Screen>
    );
  }

  if (!isStandardWeek(week)) return <Loading />;

  const chooseOne = week.challengeMode === 'chooseOne';
  const howToSoap = pathway.resources?.find((r) => r.id === 'how-to-soap');

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 48 }}>
        <PathwayLogo />
        <Title>
          Week {week.weekNumber} of {totalWeeks}
        </Title>
        <Subtitle>{week.title}</Subtitle>
        <Text style={{ fontWeight: '600', color: colors.ink }}>{week.movement}</Text>
        {isLeader ? (
          <PrimaryButton
            title="Leader Materials"
            onPress={() => router.push('/(app)/leader-materials')}
          />
        ) : null}
        {week.study ? (
          <SecondaryButton
            title="Read this week’s article"
            onPress={() => router.push('/(app)/study')}
          />
        ) : null}

        {week.talkingToGod?.length ? (
          <Card title="Talking to God">
            <BulletList items={week.talkingToGod} />
          </Card>
        ) : null}

        {week.soap?.length ? (
          <Card title="SOAP">
            <Body>Study each passage this week: Scripture, Observations, Application, Prayer.</Body>
            {week.soap.map((s) => (
              <CheckboxRow
                key={s.id}
                label={savingId === s.id ? `${s.text} (saving…)` : s.text}
                checked={myCompleted.has(s.id)}
                onToggle={(next) => toggle(s.id, next)}
              />
            ))}
            {howToSoap ? (
              <SecondaryButton
                title="How to SOAP"
                onPress={() =>
                  router.push({ pathname: '/(app)/guide', params: { id: howToSoap.id } })
                }
              />
            ) : null}
          </Card>
        ) : null}

        {week.journaling?.length ? (
          <Card title="Journaling">
            {week.journaling.map((j) => (
              <CheckboxRow
                key={j.id}
                label={savingId === j.id ? `${j.text} (saving…)` : j.text}
                checked={myCompleted.has(j.id)}
                onToggle={(next) => toggle(j.id, next)}
              />
            ))}
          </Card>
        ) : null}

        <Card title={chooseOne ? 'Challenge Options' : "Week's Challenge"}>
          {chooseOne ? <Body>Choose one option to complete this week.</Body> : null}
          {week.challenges.map((c) => (
            <View key={c.id} style={{ gap: 4 }}>
              <CheckboxRow
                label={savingId === c.id ? `${c.text} (saving…)` : c.text}
                checked={myCompleted.has(c.id)}
                onToggle={(next) => toggle(c.id, next)}
              />
              {c.details?.length ? (
                <View style={{ marginLeft: 32, marginBottom: 8 }}>
                  <StudyBlocks blocks={c.details} />
                </View>
              ) : null}
            </View>
          ))}
        </Card>

        {week.careForTheBody ? (
          <Card title="Care for the Body">
            <Body>{week.careForTheBody.text}</Body>
            <CheckboxRow
              label={
                savingId === week.careForTheBody.id
                  ? 'Completed care for the body (saving…)'
                  : 'Completed care for the body'
              }
              checked={myCompleted.has(week.careForTheBody.id)}
              onToggle={(next) => toggle(week.careForTheBody!.id, next)}
            />
          </Card>
        ) : null}
        <FeedbackLink />
      </ScrollView>
    </Screen>
  );
}
