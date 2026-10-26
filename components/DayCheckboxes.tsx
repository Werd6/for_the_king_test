import { typography } from '@/lib/theme';
import { useTheme } from '@/lib/ThemeContext';
import { Pressable, Text, View } from 'react-native';

/** A daily item: its label, an "x/N days" count, and one check box per day. */
export function DayCheckboxes({
  label,
  days,
  isChecked,
  onToggleDay,
  saving,
}: {
  label: string;
  days: number;
  isChecked: (day: number) => boolean;
  onToggleDay: (day: number, next: boolean) => void;
  saving?: boolean;
}) {
  const { colors, radii, spacing } = useTheme();
  const dayNumbers = Array.from({ length: days }, (_, i) => i + 1);
  const done = dayNumbers.filter(isChecked).length;

  return (
    <View style={{ gap: spacing.sm, marginVertical: spacing.xs }}>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
        <Text style={{ ...typography.body, color: colors.ink, flex: 1 }}>
          {saving ? `${label} (saving…)` : label}
        </Text>
        <Text
          style={{
            ...typography.label,
            color: done === days ? colors.primary : colors.mutedText,
            marginTop: 2,
          }}
        >
          {done}/{days} days
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {dayNumbers.map((day) => {
          const checked = isChecked(day);
          return (
            <Pressable
              key={day}
              accessibilityRole="checkbox"
              accessibilityLabel={`Day ${day}, ${label}`}
              accessibilityState={{ checked }}
              onPress={() => onToggleDay(day, !checked)}
              style={({ pressed }) => ({
                flex: 1,
                maxWidth: 56,
                height: 48,
                borderRadius: radii.sm,
                borderWidth: 2,
                borderColor: checked ? colors.primary : colors.muted,
                backgroundColor: checked ? colors.primary : colors.inputBg,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '600',
                  color: checked ? colors.onPrimary : colors.mutedText,
                }}
              >
                Day
              </Text>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '800',
                  color: checked ? colors.onPrimary : colors.ink,
                }}
              >
                {checked ? `✓${day}` : day}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
