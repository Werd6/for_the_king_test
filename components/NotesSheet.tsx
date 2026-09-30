import { PhotoViewer } from '@/components/PhotoViewer';
import { Body, PrimaryButton, SecondaryButton } from '@/components/ui';
import {
  addNotePhoto,
  deleteNote,
  notePhotoUrls,
  removeNotePhoto,
  saveNote,
} from '@/lib/api';
import { showAlert } from '@/lib/dialogs';
import { friendlyError } from '@/lib/errors';
import { canScan, choosePhoto, scanPages, takePhoto } from '@/lib/scan';
import { typography } from '@/lib/theme';
import { useTheme } from '@/lib/ThemeContext';
import type { JournalNote, JournalPhoto, NotesVisibility } from '@/lib/types';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const MIN_NOTE_CHARS = 10;

/** Mirrors the database rule: 10+ non-space characters or at least one photo. */
export function noteMeetsRequirement(body: string, photoCount: number) {
  return body.replace(/\s/g, '').length >= MIN_NOTE_CHARS || photoCount > 0;
}

export type NotesSheetItem = { id: string; text: string; isSoap: boolean };

export type NotesSheetResult = {
  /** True when the note still has any text or photos. */
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
  photos,
  onFinish,
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
  photos: JournalPhoto[];
  onFinish: (result: NotesSheetResult) => void;
}) {
  const { colors, radii, spacing } = useTheme();
  // Keeps content on screen while the modal animates closed.
  const [shown, setShown] = useState<NotesSheetItem | null>(null);
  const [body, setBody] = useState('');
  const [current, setCurrent] = useState<JournalNote | null>(null);
  const [currentPhotos, setCurrentPhotos] = useState<JournalPhoto[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!item) return;
    setShown(item);
    setBody(note?.body ?? '');
    setCurrent(note);
    setCurrentPhotos(photos);
    setUrls({});
    setBusy(null);
    notePhotoUrls(photos)
      .then(setUrls)
      .catch(() => {});
    // Only reset when a different item opens, not when the parent reloads notes.
  }, [item?.id]);

  const canComplete = noteMeetsRequirement(body, currentPhotos.length);
  const savedHasContent = (current?.body.trim().length ?? 0) > 0 || currentPhotos.length > 0;

  async function ensureNote(): Promise<JournalNote> {
    if (current) return current;
    const created = await saveNote({ huddleId, userId, week, itemId: item!.id, body });
    setCurrent(created);
    return created;
  }

  async function attach(source: 'scan' | 'camera' | 'library') {
    if (!item || busy) return;
    try {
      const uris =
        source === 'scan'
          ? await scanPages()
          : [await (source === 'camera' ? takePhoto() : choosePhoto())].filter(
              (u): u is string => u != null
            );
      if (!uris.length) return;
      setBusy('photo');
      const target = await ensureNote();
      const added: JournalPhoto[] = [];
      for (const uri of uris) added.push(await addNotePhoto(target, uri));
      setCurrentPhotos((prev) => [...prev, ...added]);
      const newUrls = await notePhotoUrls(added).catch(() => ({}));
      setUrls((prev) => ({ ...prev, ...newUrls }));
    } catch (e) {
      showAlert('Error', friendlyError(e, 'Could not add the photo.'));
    } finally {
      setBusy(null);
    }
  }

  async function removePhoto(photo: JournalPhoto) {
    if (busy) return;
    setBusy('photo');
    try {
      await removeNotePhoto(photo);
      setCurrentPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    } catch (e) {
      showAlert('Error', friendlyError(e, 'Could not remove the photo.'));
    } finally {
      setBusy(null);
    }
  }

  async function save(complete: boolean) {
    if (!item || busy) return;
    setBusy(complete ? 'complete' : 'save');
    try {
      const hasContent = body.trim().length > 0 || currentPhotos.length > 0;
      if (!hasContent) {
        if (current) await deleteNote(current.id, currentPhotos);
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

  async function cancel() {
    if (busy) return;
    // A note created only to hold photos that were then removed is left empty.
    if (current && !current.body.trim() && !currentPhotos.length) {
      try {
        await deleteNote(current.id, []);
      } catch {
        // Harmless: an empty note never satisfies the requirement.
      }
      onFinish({ hasContent: false, complete: false });
      return;
    }
    onFinish({ hasContent: savedHasContent, complete: false });
  }

  const viewablePhotos = currentPhotos.filter((p) => urls[p.path]);
  const shared = visibility === 'shared';
  const visibilityChanged = current != null && current.visibility !== visibility;
  const isWeb = Platform.OS === 'web';

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
            <Text style={{ ...typography.button, color: colors.primary }}>Cancel</Text>
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
            <Text style={{ fontSize: 16 }}>{shared ? '👥' : '🔒'}</Text>
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

          {required && !completed ? (
            <Body>
              Your huddle requires notes for this item. Write a few sentences or add a photo of your
              journal to check it off.
            </Body>
          ) : null}

          <TextInput
            accessibilityLabel="Notes"
            multiline
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
              fontSize: 16,
              lineHeight: 22,
              color: colors.ink,
              backgroundColor: colors.inputBg,
            }}
          />

          {currentPhotos.length ? (
            <ScrollView horizontal contentContainerStyle={{ gap: 10 }}>
              {currentPhotos.map((p) => (
                <View key={p.id}>
                  {urls[p.path] ? (
                    <Pressable
                      accessibilityRole="imagebutton"
                      accessibilityLabel="View photo full screen"
                      onPress={() => setViewerIndex(viewablePhotos.findIndex((v) => v.id === p.id))}
                    >
                      <Image
                        source={{ uri: urls[p.path] }}
                        style={{ width: 120, height: 160, borderRadius: radii.sm }}
                      />
                    </Pressable>
                  ) : (
                    <View
                      style={{
                        width: 120,
                        height: 160,
                        borderRadius: radii.sm,
                        backgroundColor: colors.surface,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <ActivityIndicator color={colors.primary} />
                    </View>
                  )}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Remove photo"
                    onPress={() => removePhoto(p)}
                    hitSlop={8}
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: 'rgba(0,0,0,0.6)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700' }}>✕</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          ) : null}
          {viewablePhotos.length ? (
            <Text style={{ ...typography.body, fontSize: 13, color: colors.mutedText }}>
              Tap a photo to view it full screen.
            </Text>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 10 }}>
            {isWeb ? (
              <View style={{ flex: 1 }}>
                <SecondaryButton
                  title="Add photo"
                  onPress={() => attach('library')}
                  disabled={busy != null}
                />
              </View>
            ) : (
              <>
                <View style={{ flex: 1 }}>
                  <SecondaryButton
                    title={canScan ? 'Scan page' : 'Take photo'}
                    onPress={() => attach(canScan ? 'scan' : 'camera')}
                    disabled={busy != null}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <SecondaryButton
                    title="Choose photo"
                    onPress={() => attach('library')}
                    disabled={busy != null}
                  />
                </View>
              </>
            )}
          </View>
          {busy === 'photo' ? <Body>Working on your photo…</Body> : null}

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
                  Write at least {MIN_NOTE_CHARS} characters or add a photo to complete this item.
                </Text>
              ) : null}
              <SecondaryButton
                title={busy === 'save' ? 'Saving…' : 'Save for later'}
                onPress={() => save(false)}
                disabled={busy != null}
              />
            </>
          )}
        </ScrollView>
        <PhotoViewer
          uris={viewablePhotos.map((p) => urls[p.path])}
          index={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      </SafeAreaView>
    </Modal>
  );
}
