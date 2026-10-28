import { Body, PrimaryButton, SecondaryButton } from '@/components/ui';
import { deleteNote, saveNote } from '@/lib/api';
import { showAlert } from '@/lib/dialogs';
import { friendlyError } from '@/lib/errors';
import { useTheme } from '@/lib/ThemeContext';
import type { JournalNote, NotesVisibility } from '@/lib/types';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const MIN_NOTE_CHARS = 10;

/** Mirrors the database rule: 10+ non-space characters. */
export function noteMeetsRequirement(body: string) {
  return body.replace(/\s/g, '').length >= MIN_NOTE_CHARS;
}

export type NotesSheetItem = { id: string; text: string; isSoap: boolean };

export type NotesSheetResult = {
  /** True when the note still has any text. */
  hasContent: boolean;
  /** True when the member tapped "Save & complete". */
  complete: boolean;
};

const SOAP_PLACEHOLDER =
  'S — Scripture: write out the verse that stood out.\nO — Observations: what do you notice?\nA — Application: how does it apply to you?\nP — Prayer: write a short prayer.';

export function NotesSheet({
  item,
  huddleId,
  userId,
  week,
  visibility,
  required,
  completed,
  note,
  onFinish,
  readOnly,
}: {
  /** The item being journaled; null hides the sheet. */
  item: NotesSheetItem | null;
  huddleId: string;
  userId: string;
  week: number;
  /** The huddle's current notes visibility setting. */
  visibility: NotesVisibility;
  required: boolean;
  completed: boolean;
  note: JournalNote | null;
  onFinish: (result: NotesSheetResult) => void;
  /** View only: the Huddle Pass isn't active. */
  readOnly?: boolean;
}) {
  const { colors, radii, spacing, fonts, typography } = useTheme();
  // Keeps content on screen while the modal animates closed.
  const [shown, setShown] = useState<NotesSheetItem | null>(null);
  const [body, setBody] = useState('');
  const [current, setCurrent] = useState<JournalNote | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!item) return;
    setShown(item);
    setBody(note?.body ?? '');
    setCurrent(note);
    setBusy(null);
    // Only reset when a different item opens, not when the parent reloads notes.
  }, [item?.id]);

  const canComplete = noteMeetsRequirement(body);
  const savedHasContent = (current?.body.trim().length ?? 0) > 0;

  async function save(complete: boolean) {
    if (!item || busy) return;
    setBusy(complete ? 'complete' : 'save');
    try {
      const hasContent = body.trim().length > 0;
      if (!hasContent) {
        if (current) await deleteNote(current.id);
        setCurrent(null);
      } else {
        setCurrent(await saveNote({ huddleId, userId, week, itemId: item.id, body }));
      }
      onFinish({ hasContent, complete: complete && hasContent });
    } catch (e) {
      showAlert('Error', friendlyError(e, 'Could not save your notes.'));
    } finally {
      setBusy(null);
    }
  }

  function cancel() {
    if (busy) return;
    onFinish({ hasContent: savedHasContent, complete: false });
  }

  const shared = visibility === 'shared';
  const visibilityChanged = current != null && current.visibility !== visibility;

  return (
    <Modal
      visible={item != null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={cancel}
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
            gap: 12,
          }}
        >
          <Pressable accessibilityRole="button" onPress={cancel} hitSlop={12}>
            <Text style={{ ...typography.button, color: colors.primary }}>
              {readOnly ? 'Close' : 'Cancel'}
            </Text>
          </Pressable>
          <Text
            style={{ ...typography.section, color: colors.ink, flex: 1, textAlign: 'center' }}
            accessibilityRole="header"
          >
            Your notes
          </Text>
          <View style={{ width: 56 }} />
        </View>
        <ScrollView
          contentContainerStyle={{ gap: 12, padding: 16, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={{ ...typography.subtitle, color: colors.ink }}>{shown?.text}</Text>

          <View
            style={{
              flexDirection: 'row',
              gap: 10,
              alignItems: 'flex-start',
              padding: spacing.md,
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
            }}
            accessibilityRole="text"
          >
            <Text style={{ ...fonts.regular, fontSize: 16 }}>{shared ? '👥' : '🔒'}</Text>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ ...typography.label, color: colors.ink }}>
                {shared
                  ? 'Everyone in your huddle can read these notes.'
                  : 'Only you can see these notes.'}
              </Text>
              {visibilityChanged ? (
                <Text style={{ ...typography.body, fontSize: 13, color: colors.mutedText }}>
                  Your leader changed this setting since you last saved. Saving applies it to this
                  note.
                </Text>
              ) : null}
            </View>
          </View>

          {readOnly ? (
            <Body>Your Huddle Pass isn&apos;t active, so these notes are view only.</Body>
          ) : required && !completed ? (
            <Body>
              Your huddle requires notes for this item. Write a few sentences to check it off.
            </Body>
          ) : null}

          <TextInput
            accessibilityLabel="Notes"
            multiline
            editable={!readOnly}
            value={body}
            onChangeText={setBody}
            placeholder={shown?.isSoap ? SOAP_PLACEHOLDER : 'Write your thoughts…'}
            placeholderTextColor={colors.mutedText}
            textAlignVertical="top"
            style={{
              minHeight: 200,
              borderWidth: 1.5,
              borderColor: colors.muted,
              borderRadius: radii.sm,
              padding: 10,
              ...fonts.regular,
              fontSize: 16,
              lineHeight: 22,
              color: colors.ink,
              backgroundColor: colors.inputBg,
            }}
          />

          {readOnly ? null : (
            <>
              {completed ? (
                <PrimaryButton
                  title={busy === 'save' ? 'Saving…' : 'Save'}
                  onPress={() => save(false)}
                  disabled={busy != null}
                />
              ) : (
                <>
                  <PrimaryButton
                    title={busy === 'complete' ? 'Saving…' : 'Save & complete'}
                    onPress={() => save(true)}
                    disabled={busy != null || !canComplete}
                  />
                  {!canComplete ? (
                    <Text style={{ ...typography.body, fontSize: 13, color: colors.mutedText }}>
                      Write at least {MIN_NOTE_CHARS} characters to complete this item.
                    </Text>
                  ) : null}
                  <SecondaryButton
                    title={busy === 'save' ? 'Saving…' : 'Save for later'}
                    onPress={() => save(false)}
                    disabled={busy != null}
                  />
                </>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
