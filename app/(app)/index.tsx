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
import {
  NotesSheet,
  noteMeetsRequirement,
  type NotesSheetItem,
  type NotesSheetResult,
} from '@/components/NotesSheet';
import { PathwayLogo } from '@/components/PathwayLogo';
import { StudyBlocks } from '@/components/StudyBlocks';
import {
  getNotesForWeek,
  getProgressForWeek,
  getWeekPick,
  setProgress,
  setWeekPick,
  type WeekNotes,
} from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { friendlyError } from '@/lib/errors';
import { isGroupChallengeWeek, isStandardWeek } from '@/lib/content';
import { useContent } from '@/lib/ContentContext';
import { showAlert } from '@/lib/dialogs';
import { typography } from '@/lib/theme';
import { useTheme } from '@/lib/ThemeContext';
import type { ChallengeItem, ProgressRow } from '@/lib/types';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

const NO_NOTES: WeekNotes = { notes: [], photos: [] };

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
  const [weekNotes, setWeekNotes] = useState<WeekNotes>(NO_NOTES);
  const [sheetItem, setSheetItem] = useState<(NotesSheetItem & { requiresNote: boolean }) | null>(
    null
  );

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!huddle) return;
      if (!opts?.silent) setInitialLoading(true);
      try {
        const rows = await getProgressForWeek(huddle.id, huddle.current_week);
        setProgressRows(rows);
        const pick = await getWeekPick(huddle.id, huddle.current_week);
        setPickId(pick?.option_id ?? null);
        // Notes are optional extras; a project without journaling set up still loads the week.
        setWeekNotes(await getNotesForWeek(huddle.id, huddle.current_week).catch(() => NO_NOTES));
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
  const notesRequired = huddle.settings.requireNotes;

  function myNote(itemId: string) {
    return weekNotes.notes.find((n) => n.user_id === userId && n.item_id === itemId) ?? null;
  }

  function myNotePhotos(itemId: string) {
    const note = myNote(itemId);
    return note ? weekNotes.photos.filter((p) => p.note_id === note.id) : [];
  }

  function openNotes(item: ChallengeItem, isSoap: boolean) {
    setSheetItem({
      id: item.id,
      text: item.text,
      isSoap,
      requiresNote: Boolean(item.requiresNote),
    });
  }

  function onCheck(item: ChallengeItem, next: boolean, isSoap: boolean) {
    if (next && notesRequired && item.requiresNote) {
      const note = myNote(item.id);
      if (!noteMeetsRequirement(note?.body ?? '', myNotePhotos(item.id).length)) {
        openNotes(item, isSoap);
        return;
      }
    }
    toggle(item.id, next);
  }

  async function onNotesFinished(result: NotesSheetResult) {
    const item = sheetItem;
    setSheetItem(null);
    if (!item) return;
    const checked = myCompleted.has(item.id);
    if (result.complete && !checked) {
      await toggle(item.id, true);
    } else if (!result.hasContent && checked && notesRequired && item.requiresNote) {
      await toggle(item.id, false);
    } else {
      await load({ silent: true }).catch(() => {});
    }
  }

  function itemRow(item: ChallengeItem, opts?: { label?: string; isSoap?: boolean }) {
    const label = opts?.label ?? item.text;
    const isSoap = Boolean(opts?.isSoap);
    const note = myNote(item.id);
    const hasNote = Boolean(note && (note.body.trim() || myNotePhotos(item.id).length));
    return (
      <>
        <CheckboxRow
          label={savingId === item.id ? `${label} (saving…)` : label}
          checked={myCompleted.has(item.id)}
          onToggle={(next) => onCheck(item, next, isSoap)}
        />
        {item.requiresNote ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => openNotes(item, isSoap)}
            hitSlop={6}
            style={{ marginLeft: 32, marginTop: -2, marginBottom: 6 }}
          >
            <Text style={{ ...typography.label, color: colors.primary }}>
              {hasNote
                ? '📝 Notes attached · Edit'
                : notesRequired
                  ? 'Notes required · Add notes'
                  : 'Add notes (optional)'}
            </Text>
          </Pressable>
        ) : null}
      </>
    );
  }

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
      // The leader may have turned on required notes since this screen loaded.
      if (/NOTE_REQUIRED/.test(String((e as { message?: unknown })?.message ?? ''))) {
        await refresh();
      }
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
              <View key={s.id}>{itemRow(s, { isSoap: true })}</View>
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
              <View key={j.id}>{itemRow(j)}</View>
            ))}
          </Card>
        ) : null}

        <Card title={chooseOne ? 'Challenge Options' : "Week's Challenge"}>
          {chooseOne ? <Body>Choose one option to complete this week.</Body> : null}
          {week.challenges.map((c) => (
            <View key={c.id} style={{ gap: 4 }}>
              {itemRow(c)}
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
            {itemRow(week.careForTheBody, { label: 'Completed care for the body' })}
          </Card>
        ) : null}
        <FeedbackLink />
      </ScrollView>
      <NotesSheet
        item={sheetItem}
        huddleId={huddle.id}
        userId={userId}
        week={huddle.current_week}
        visibility={huddle.settings.notesVisibility}
        required={notesRequired && Boolean(sheetItem?.requiresNote)}
        completed={sheetItem ? myCompleted.has(sheetItem.id) : false}
        note={sheetItem ? myNote(sheetItem.id) : null}
        photos={sheetItem ? myNotePhotos(sheetItem.id) : []}
        onFinish={onNotesFinished}
      />
    </Screen>
  );
}
