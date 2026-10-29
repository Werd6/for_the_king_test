import { PhotoViewer } from '@/components/PhotoViewer';
import { Body, Field, PrimaryButton, SecondaryButton } from '@/components/ui';
import { blockUser, notePhotoUrls, reportNote, type ReportReason } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { confirmAction, showAlert } from '@/lib/dialogs';
import { friendlyError } from '@/lib/errors';
import { useTheme } from '@/lib/ThemeContext';
import type { JournalNote, JournalPhoto } from '@/lib/types';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export type ViewedNote = {
  note: JournalNote;
  photos: JournalPhoto[];
  authorName: string;
  itemText: string;
};

const REASONS: { id: ReportReason; label: string }[] = [
  { id: 'abusive', label: 'Offensive or abusive' },
  { id: 'spam', label: 'Spam or unrelated' },
  { id: 'other', label: 'Something else' },
];

/** Read-only view of a note someone shared with the huddle, with Report and Block. */
export function NoteViewer({
  viewed,
  onClose,
  onBlocked,
}: {
  viewed: ViewedNote | null;
  onClose: () => void;
  /** Called after blocking the author, so the screen can reload without their notes. */
  onBlocked?: () => void;
}) {
  const { colors, radii, typography } = useTheme();
  const { userId, usingLocalMode } = useAuth();
  const { width } = useWindowDimensions();
  // Keeps content on screen while the modal animates closed.
  const [shown, setShown] = useState<ViewedNote | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [photoError, setPhotoError] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [reportStep, setReportStep] = useState<'closed' | 'open' | 'sent'>('closed');
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!viewed) return;
    setShown(viewed);
    setUrls({});
    setPhotoError(false);
    setReportStep('closed');
    setReason(null);
    setDetails('');
    notePhotoUrls(viewed.photos)
      .then(setUrls)
      .catch(() => setPhotoError(true));
  }, [viewed]);

  const photoWidth = Math.min(width, 700) - 32;
  const viewablePhotos = (shown?.photos ?? []).filter((p) => urls[p.path]);
  const canModerate = !usingLocalMode && Boolean(userId) && shown?.note.user_id !== userId;

  async function sendReport() {
    if (!shown || !reason) return;
    setBusy(true);
    try {
      await reportNote(shown.note.id, reason, details);
      setReportStep('sent');
    } catch (e) {
      showAlert('Report', friendlyError(e, 'Could not send the report. Try again.'));
    } finally {
      setBusy(false);
    }
  }

  async function block() {
    if (!shown || !userId) return;
    const ok = await confirmAction(
      `Block ${shown.authorName}?`,
      'You won’t see their shared notes or photos. They aren’t told. You can unblock them in Settings.',
      'Block'
    );
    if (!ok) return;
    setBusy(true);
    try {
      await blockUser(userId, shown.note.user_id);
      onClose();
      onBlocked?.();
    } catch (e) {
      showAlert('Block', friendlyError(e, 'Could not block. Try again.'));
    } finally {
      setBusy(false);
    }
  }

  const linkStyle = { ...typography.button, color: colors.primary };

  return (
    <Modal
      visible={viewed != null}
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
            {shown ? `${shown.authorName}’s notes` : 'Notes'}
          </Text>
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={12}>
            <Text style={{ ...typography.button, color: colors.primary }}>Done</Text>
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={{ gap: 12, padding: 16, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
        >
          {shown ? (
            <>
              <Text style={{ ...typography.subtitle, color: colors.ink }}>{shown.itemText}</Text>
              <Text style={{ ...typography.body, fontSize: 13, color: colors.mutedText }}>
                Shared with the huddle · View only
              </Text>
              {shown.note.body.trim() ? (
                <Text style={{ ...typography.body, color: colors.ink }} selectable>
                  {shown.note.body}
                </Text>
              ) : null}
              {photoError ? <Body>Photos couldn’t be loaded. Try again later.</Body> : null}
              {viewablePhotos.length ? (
                <Text style={{ ...typography.body, fontSize: 13, color: colors.mutedText }}>
                  Tap a photo to view it full screen.
                </Text>
              ) : null}
              {shown.photos.map((p) =>
                urls[p.path] ? (
                  <Pressable
                    key={p.id}
                    accessibilityRole="imagebutton"
                    accessibilityLabel="View photo full screen"
                    onPress={() => setViewerIndex(viewablePhotos.findIndex((v) => v.id === p.id))}
                  >
                    <Image
                      source={{ uri: urls[p.path] }}
                      style={{
                        width: photoWidth,
                        height: photoWidth * 1.3,
                        borderRadius: radii.md,
                        backgroundColor: colors.surface,
                      }}
                      resizeMode="contain"
                    />
                  </Pressable>
                ) : photoError ? null : (
                  <View
                    key={p.id}
                    style={{
                      height: 160,
                      borderRadius: radii.md,
                      backgroundColor: colors.surface,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ActivityIndicator color={colors.primary} />
                  </View>
                )
              )}

              {canModerate ? (
                <View
                  style={{
                    gap: 12,
                    marginTop: 12,
                    paddingTop: 16,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                  }}
                >
                  {reportStep === 'open' ? (
                    <>
                      <Text style={{ ...typography.subtitle, color: colors.ink }} accessibilityRole="header">
                        Report this note
                      </Text>
                      <Body>What’s wrong with it?</Body>
                      {REASONS.map((r) =>
                        reason === r.id ? (
                          <PrimaryButton key={r.id} title={`✓ ${r.label}`} onPress={() => setReason(r.id)} />
                        ) : (
                          <SecondaryButton key={r.id} title={r.label} onPress={() => setReason(r.id)} />
                        )
                      )}
                      <Field
                        label="Details (optional)"
                        value={details}
                        onChangeText={setDetails}
                        autoCapitalize="sentences"
                      />
                      <PrimaryButton
                        title={busy ? 'Sending…' : 'Send report'}
                        onPress={sendReport}
                        disabled={!reason || busy}
                      />
                      <SecondaryButton title="Cancel" onPress={() => setReportStep('closed')} disabled={busy} />
                    </>
                  ) : reportStep === 'sent' ? (
                    <Body>
                      Thanks for telling us. We review reports within 24 hours and remove content that
                      breaks our community standards.
                    </Body>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setReportStep('open')}
                      hitSlop={6}
                    >
                      <Text style={linkStyle}>Report this note</Text>
                    </Pressable>
                  )}
                  {reportStep !== 'open' ? (
                    <Pressable accessibilityRole="button" onPress={block} disabled={busy} hitSlop={6}>
                      <Text style={{ ...linkStyle, color: colors.danger }}>Block {shown.authorName}</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </>
          ) : null}
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
