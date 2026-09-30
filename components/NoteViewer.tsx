import { Body } from '@/components/ui';
import { notePhotoUrls } from '@/lib/api';
import { typography } from '@/lib/theme';
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

/** Read-only view of a note someone shared with the huddle. */
export function NoteViewer({ viewed, onClose }: { viewed: ViewedNote | null; onClose: () => void }) {
  const { colors, radii } = useTheme();
  const { width } = useWindowDimensions();
  // Keeps content on screen while the modal animates closed.
  const [shown, setShown] = useState<ViewedNote | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [photoError, setPhotoError] = useState(false);

  useEffect(() => {
    if (!viewed) return;
    setShown(viewed);
    setUrls({});
    setPhotoError(false);
    notePhotoUrls(viewed.photos)
      .then(setUrls)
      .catch(() => setPhotoError(true));
  }, [viewed]);

  const photoWidth = Math.min(width, 700) - 32;

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
        <ScrollView contentContainerStyle={{ gap: 12, padding: 16, paddingBottom: 48 }}>
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
              {shown.photos.map((p) =>
                urls[p.path] ? (
                  <Image
                    key={p.id}
                    source={{ uri: urls[p.path] }}
                    style={{
                      width: photoWidth,
                      height: photoWidth * 1.3,
                      borderRadius: radii.md,
                      backgroundColor: colors.surface,
                    }}
                    resizeMode="contain"
                    accessibilityLabel="Journal photo"
                  />
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
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
