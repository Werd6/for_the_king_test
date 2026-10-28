import { useTheme } from '@/lib/ThemeContext';
import type { JournalNote } from '@/lib/types';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export type ViewedNote = {
  note: JournalNote;
  authorName: string;
  itemText: string;
};

/** Read-only view of a note someone shared with the huddle. */
export function NoteViewer({ viewed, onClose }: { viewed: ViewedNote | null; onClose: () => void }) {
  const { colors, typography } = useTheme();
  // Keeps content on screen while the modal animates closed.
  const [shown, setShown] = useState<ViewedNote | null>(null);

  useEffect(() => {
    if (viewed) setShown(viewed);
  }, [viewed]);

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
              <Text style={{ ...typography.body, color: colors.ink }} selectable>
                {shown.note.body}
              </Text>
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
