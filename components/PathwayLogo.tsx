import { Image, View } from 'react-native';
import { useTheme } from '@/lib/ThemeContext';

/** The active pathway's logo with a short accent rule beneath. Renders nothing without a logo. */
export function PathwayLogo({ height = 48 }: { height?: number }) {
  const { logo, colors, spacing, tabTitle } = useTheme();
  if (!logo) return null;
  return (
    <View style={{ alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
      <Image
        source={logo}
        resizeMode="contain"
        accessibilityRole="image"
        accessibilityLabel={`${tabTitle} logo`}
        style={{ height, width: height * 3 }}
      />
      <View style={{ width: 40, height: 2, borderRadius: 1, backgroundColor: colors.accent }} />
    </View>
  );
}
