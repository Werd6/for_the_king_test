import { Platform, TextInput, View, type TextStyle } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '@/lib/ThemeContext';
import { radii, spacing } from '@/lib/theme';

/** Format for HTML datetime-local (local timezone, no seconds). */
export function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function parseDatetimeLocalValue(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Sensible default: next top of the hour. */
export function defaultMeetingTime(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

/**
 * Cross-platform date+time control.
 * Web: native `<input type="datetime-local">` (RN DateTimePicker is a no-op / blank on web).
 * iOS/Android: community DateTimePicker.
 */
export function DateTimeField({
  value,
  onChange,
}: {
  value: Date;
  onChange: (next: Date) => void;
}) {
  const { colors } = useTheme();

  if (Platform.OS === 'web') {
    const webStyle: TextStyle = {
      borderWidth: 1.5,
      borderColor: colors.muted,
      borderRadius: radii.sm,
      paddingHorizontal: 10,
      paddingVertical: spacing.sm,
      fontSize: 16,
      color: colors.ink,
      backgroundColor: colors.inputBg,
      // @ts-expect-error RN web accepts CSS color scheme
      colorScheme: 'dark',
      minHeight: 44,
    };

    return (
      <View>
        {/* RN Web forwards unknown props like `type` to the DOM input */}
        <TextInput
          // @ts-expect-error web-only attribute
          type="datetime-local"
          value={toDatetimeLocalValue(value)}
          onChangeText={(text) => {
            const next = parseDatetimeLocalValue(text);
            if (next) onChange(next);
          }}
          style={webStyle}
          placeholderTextColor={colors.muted}
        />
      </View>
    );
  }

  return (
    <DateTimePicker
      value={value}
      mode="datetime"
      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
      onChange={(_, date) => {
        if (date) onChange(date);
      }}
    />
  );
}
