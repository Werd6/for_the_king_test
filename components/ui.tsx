import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '@/lib/ThemeContext';
import { radii, spacing, typography, type ThemeColors } from '@/lib/theme';

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      padding: spacing.lg,
      gap: spacing.md,
      backgroundColor: colors.bg,
    },
    title: {
      ...typography.title,
      color: colors.ink,
      marginBottom: spacing.xs,
    },
    subtitle: {
      ...typography.subtitle,
      color: colors.ink,
      marginBottom: spacing.xs,
    },
    body: {
      ...typography.body,
      color: colors.ink,
    },
    section: {
      marginTop: spacing.md,
      gap: spacing.sm,
    },
    sectionTitle: {
      ...typography.section,
      color: colors.ink,
    },
    card: {
      borderWidth: 1,
      borderColor: colors.muted,
      borderRadius: radii.md,
      padding: 14,
      marginTop: spacing.xs,
      backgroundColor: colors.surface,
      gap: 10,
    },
    cardTitle: {
      ...typography.section,
      color: colors.ink,
    },
    cardBody: {
      gap: spacing.sm,
    },
    field: {
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    label: {
      ...typography.label,
      color: colors.ink,
    },
    input: {
      borderWidth: 1.5,
      borderColor: colors.muted,
      borderRadius: radii.sm,
      paddingHorizontal: 10,
      paddingVertical: spacing.sm,
      fontSize: 16,
      color: colors.ink,
      backgroundColor: colors.inputBg,
    },
    inputFocused: {
      borderColor: colors.primary,
    },
    checkRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      marginVertical: spacing.xs,
      paddingVertical: 2,
    },
    checkbox: {
      width: 22,
      height: 22,
      marginTop: 1,
      borderWidth: 2,
      borderColor: colors.muted,
      borderRadius: radii.sm,
      backgroundColor: colors.inputBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxChecked: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    checkboxMark: {
      color: colors.onPrimary,
      fontSize: 14,
      fontWeight: '800',
      lineHeight: 16,
    },
    checkLabel: {
      flex: 1,
      ...typography.body,
      color: colors.ink,
      lineHeight: 22,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      paddingVertical: 12,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: spacing.xs,
    },
    primaryButtonPressed: {
      opacity: 0.85,
    },
    primaryButtonDisabled: {
      opacity: 0.45,
    },
    primaryButtonText: {
      ...typography.button,
      color: colors.onPrimary,
    },
    secondaryButton: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: colors.muted,
      borderRadius: radii.md,
      paddingVertical: 12,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: spacing.xs,
    },
    secondaryButtonPressed: {
      backgroundColor: colors.surfaceStrong,
    },
    secondaryButtonText: {
      ...typography.button,
      color: colors.ink,
    },
    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bg,
    },
    bullet: {
      ...typography.body,
      color: colors.ink,
      marginBottom: spacing.xs,
    },
    settingsGroupWrap: {
      marginTop: spacing.md,
      gap: spacing.sm,
    },
    settingsGroupLabel: {
      fontSize: 13,
      fontWeight: '600',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      color: colors.muted,
      marginLeft: spacing.xs,
    },
    settingsGroup: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    settingsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 48,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      gap: spacing.sm,
    },
    settingsRowPressed: {
      backgroundColor: colors.surfaceStrong,
      opacity: 0.9,
    },
    settingsRowDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginLeft: spacing.md,
    },
    settingsRowLabel: {
      flex: 1,
      fontSize: 16,
      fontWeight: '500',
      color: colors.ink,
    },
    settingsRowLabelDanger: {
      color: colors.danger,
    },
    settingsRowValue: {
      fontSize: 15,
      color: colors.muted,
      maxWidth: '45%',
    },
    settingsRowChevron: {
      fontSize: 20,
      color: colors.muted,
      fontWeight: '300',
      marginLeft: 2,
    },
    settingsFooter: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.muted,
      marginTop: spacing.sm,
      marginHorizontal: spacing.xs,
    },
    segmentTrack: {
      flexDirection: 'row',
      backgroundColor: colors.inputBg,
      borderRadius: radii.md,
      padding: 3,
      margin: spacing.sm,
      gap: 2,
    },
    segmentItem: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radii.sm,
    },
    segmentItemActive: {
      backgroundColor: colors.primary,
    },
    segmentItemText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.muted,
    },
    segmentItemTextActive: {
      color: colors.onPrimary,
    },
    settingsFieldPad: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
    },
  });
}

function useUiStyles() {
  const { colors } = useTheme();
  return useMemo(() => ({ colors, styles: makeStyles(colors) }), [colors]);
}

export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { styles } = useUiStyles();
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function Title({ children }: { children: React.ReactNode }) {
  const { styles } = useUiStyles();
  return <Text style={styles.title}>{children}</Text>;
}

export function Subtitle({ children }: { children: React.ReactNode }) {
  const { styles } = useUiStyles();
  return <Text style={styles.subtitle}>{children}</Text>;
}

export function Body({ children }: { children: React.ReactNode }) {
  const { styles } = useUiStyles();
  return <Text style={styles.body}>{children}</Text>;
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { styles } = useUiStyles();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

/** Simple bordered card for visually separating week sections */
export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  const { styles } = useUiStyles();
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  secureTextEntry,
  placeholder,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  secureTextEntry?: boolean;
  placeholder?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  const { colors, styles } = useUiStyles();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, focused && styles.inputFocused]}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        autoCapitalize={autoCapitalize ?? 'none'}
        autoCorrect={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </View>
  );
}

export function CheckboxRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: (next: boolean) => void;
}) {
  const { styles } = useUiStyles();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => onToggle(!checked)}
      style={({ pressed }) => [styles.checkRow, pressed && { opacity: 0.75 }]}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked ? <Text style={styles.checkboxMark}>✓</Text> : null}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

export function PrimaryButton({
  title,
  onPress,
  disabled,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { styles } = useUiStyles();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        pressed && !disabled && styles.primaryButtonPressed,
        disabled && styles.primaryButtonDisabled,
      ]}
    >
      <Text style={styles.primaryButtonText}>{title}</Text>
    </Pressable>
  );
}

export function SecondaryButton({
  title,
  onPress,
  disabled,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { styles } = useUiStyles();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        pressed && !disabled && styles.secondaryButtonPressed,
        disabled && styles.primaryButtonDisabled,
      ]}
    >
      <Text style={styles.secondaryButtonText}>{title}</Text>
    </Pressable>
  );
}

export function Loading() {
  const { colors, styles } = useUiStyles();
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

export function BulletList({ items }: { items: string[] }) {
  const { styles } = useUiStyles();
  return (
    <View>
      {items.map((item, i) => (
        <Text key={`${i}-${item.slice(0, 12)}`} style={styles.bullet}>
          • {item}
        </Text>
      ))}
    </View>
  );
}

/** Grouped settings card (iOS-style list section). */
export function SettingsGroup({
  label,
  children,
  footer,
}: {
  label?: string;
  children: React.ReactNode;
  footer?: string;
}) {
  const { styles } = useUiStyles();
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.settingsGroupWrap}>
      {label ? <Text style={styles.settingsGroupLabel}>{label}</Text> : null}
      <View style={styles.settingsGroup}>
        {items.map((child, i) => (
          <React.Fragment key={i}>
            {i > 0 ? <View style={styles.settingsRowDivider} /> : null}
            {child}
          </React.Fragment>
        ))}
      </View>
      {footer ? <Text style={styles.settingsFooter}>{footer}</Text> : null}
    </View>
  );
}

export function SettingsRow({
  label,
  value,
  onPress,
  destructive,
  showChevron = true,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  showChevron?: boolean;
}) {
  const { styles } = useUiStyles();
  const content = (
    <>
      <Text style={[styles.settingsRowLabel, destructive && styles.settingsRowLabelDanger]}>
        {label}
      </Text>
      {value ? (
        <Text style={styles.settingsRowValue} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {onPress && showChevron ? <Text style={styles.settingsRowChevron}>›</Text> : null}
    </>
  );

  if (!onPress) {
    return <View style={styles.settingsRow}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.settingsRow, pressed && styles.settingsRowPressed]}
    >
      {content}
    </Pressable>
  );
}

export function SettingsSegmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  const { styles } = useUiStyles();
  return (
    <View style={styles.segmentTrack}>
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <Pressable
            key={opt.id}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(opt.id)}
            style={[styles.segmentItem, active && styles.segmentItemActive]}
          >
            <Text style={[styles.segmentItemText, active && styles.segmentItemTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Padded slot for inputs inside a SettingsGroup. */
export function SettingsInset({ children }: { children: React.ReactNode }) {
  const { styles } = useUiStyles();
  return <View style={styles.settingsFieldPad}>{children}</View>;
}
