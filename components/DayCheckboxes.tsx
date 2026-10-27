import { useTheme } from '@/lib/ThemeContext';
import { Pressable, Text, View } from 'react-native';

/** A daily item: its label, an "x/N days" count, and one check box per day. */
export function DayCheckboxes({
  label,
  days,
  isChecked,
  onToggleDay,
  saving,
  disabled,
}: {
  label: string;
  days: number;
  isChecked: (day: number) => boolean;
  onToggleDay: (day: number, next: boolean) => void;
  saving?: boolean;
  disabled?: boolean;
}) {
  const { colors, radii, spacing, fonts, typography } = useTheme();
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
              accessibilityState={{ checked, disabled: Boolean(disabled) }}
              disabled={disabled}
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
                opacity: disabled ? 0.55 : pressed ? 0.75 : 1,
              })}
            >
              <Text
                style={{
                  ...fonts.semibold,
                  fontSize: 10,
                  color: checked ? colors.onPrimary : colors.mutedText,
                }}
              >
                Day
              </Text>
              <Text
                style={{
                  ...fonts.bold,
                  fontSize: 15,
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
