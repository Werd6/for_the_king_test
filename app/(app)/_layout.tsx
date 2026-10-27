import { Stack } from 'expo-router';
import { LeaderTourProvider } from '@/components/LeaderTour';
import { Loading } from '@/components/ui';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';

export const unstable_settings = { initialRouteName: '(tabs)' };

export default function AppLayout() {
  const { colors } = useTheme();
  const { loading } = useAuth();

  if (loading) return <Loading />;

  return (
    <LeaderTourProvider>
      <Stack
        screenOptions={{
          headerBackTitle: 'Back',
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.ink,
          headerTitleStyle: { fontWeight: '700', color: colors.ink },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="guide" options={{ title: 'Guide' }} />
        <Stack.Screen name="leader-guide" options={{ title: 'Leader Guide' }} />
        <Stack.Screen name="leader-materials" options={{ title: 'Leader Materials' }} />
        <Stack.Screen name="challenge-pool" options={{ title: 'Challenge Pool' }} />
        <Stack.Screen name="meetings" options={{ title: 'Meetings' }} />
      </Stack>
    </LeaderTourProvider>
  );
}
