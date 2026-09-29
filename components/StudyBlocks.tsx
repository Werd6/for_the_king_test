import { Fragment } from 'react';
import { Text, View, type TextStyle } from 'react-native';
import { typography } from '@/lib/theme';
import { useTheme } from '@/lib/ThemeContext';
import type { StudyBlock } from '@/lib/types';

/** Renders `**bold**` and `*italic*` spans inside a string. */
export function RichText({ text, style }: { text: string; style?: TextStyle | TextStyle[] }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
  return (
    <Text style={style}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <Text key={i} style={{ fontWeight: '700' }}>
              {part.slice(2, -2)}
            </Text>
          );
        }
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
          return (
            <Text key={i} style={{ fontStyle: 'italic' }}>
              {part.slice(1, -1)}
            </Text>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </Text>
  );
}

export function QuoteBlock({ text, source }: { text: string; source?: string }) {
  const { colors, spacing } = useTheme();
  return (
    <View
      style={{
        borderLeftWidth: 3,
        borderLeftColor: colors.accent,
        paddingLeft: spacing.md,
        paddingVertical: spacing.xs,
        gap: spacing.xs,
      }}
    >
      <RichText text={text} style={{ ...typography.body, color: colors.ink, lineHeight: 24 }} />
      {source ? (
        <RichText
          text={`— ${source}`}
          style={{ fontSize: 14, lineHeight: 20, color: colors.mutedText }}
        />
      ) : null}
    </View>
  );
}

export function StudyBlocks({ blocks }: { blocks: StudyBlock[] }) {
  const { colors, spacing } = useTheme();
  const body: TextStyle = { ...typography.body, color: colors.ink, lineHeight: 24 };

  return (
    <View style={{ gap: spacing.md }}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'paragraph':
            return <RichText key={i} text={block.text} style={body} />;
          case 'heading':
            return (
              <Text
                key={i}
                accessibilityRole="header"
                style={{ ...typography.section, color: colors.ink, marginTop: spacing.xs }}
              >
                {block.text}
              </Text>
            );
          case 'quote':
            return <QuoteBlock key={i} text={block.text} source={block.source} />;
          case 'list':
            return (
              <View key={i} style={{ gap: spacing.xs }}>
                {block.items.map((item, n) => (
                  <View key={n} style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <Text style={[body, { minWidth: 16 }]}>{block.ordered ? `${n + 1}.` : '•'}</Text>
                    <RichText text={item} style={[body, { flex: 1 }]} />
                  </View>
                ))}
              </View>
            );
          default:
            return null;
        }
      })}
    </View>
  );
}
