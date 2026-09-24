import { Tabs } from 'expo-router';
import { useTheme } from '@/lib/ThemeContext';

export default function AppLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.ink,
        headerTitleStyle: { fontWeight: '700', color: colors.ink },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.muted,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'This Week' }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      <Tabs.Screen name="leader-guide" options={{ title: 'Leader Guide', href: null }} />
      <Tabs.Screen name="leader-materials" options={{ title: 'Leader Materials', href: null }} />
      <Tabs.Screen name="challenge-pool" options={{ title: 'Challenge Pool', href: null }} />
      <Tabs.Screen name="meetings" options={{ title: 'Meetings', href: null }} />
    </Tabs>
  );
}
