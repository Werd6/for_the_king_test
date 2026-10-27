import { Redirect, Stack } from 'expo-router';
import { useEffect } from 'react';
import { LeaderTourProvider } from '@/components/LeaderTour';
import { Loading } from '@/components/ui';
import { useAuth } from '@/lib/AuthContext';
import { scheduleMeetingReminder } from '@/lib/notifications';
import { useTheme } from '@/lib/ThemeContext';

export const unstable_settings = { initialRouteName: '(tabs)' };

/**
 * The current account's weekly meeting reminder. Each signed-in account keeps its own, so
 * swapping accounts doesn't cancel the others (signing out of an account does).
 */
function MeetingReminder() {
  const { userId, huddle, savedAccounts } = useAuth();
  const { colors } = useTheme();
  const accent = colors.accent;
  const huddleId = huddle?.id;
  const huddleName = huddle?.name ?? '';
  const pathwayId = huddle?.pathway_id;
  const meetingTime = huddle?.meetings.time ?? null;
  const meetingLocation = huddle?.meetings.location ?? null;
  // Scheduling needs the account saved with this huddle, which can land just after sign-in.
  const saved = savedAccounts.some((a) => a.userId === userId && a.huddleId === huddleId);

  useEffect(() => {
    if (!userId || !huddleId || !saved) return;
    scheduleMeetingReminder(
      { time: meetingTime, location: meetingLocation },
      { userId, huddleId, huddleName, pathwayId, color: accent }
    ).catch((e) => console.warn('Could not schedule the meeting reminder:', e));
  }, [userId, huddleId, huddleName, saved, pathwayId, meetingTime, meetingLocation, accent]);

  return null;
}

export default function AppLayout() {
  const { colors, fonts } = useTheme();
  const { loading, userId, huddle } = useAuth();

  if (loading) return <Loading />;
  if (!userId) return <Redirect href="/(auth)/sign-in" />;
  if (!huddle) return <Redirect href="/(onboarding)/join-create" />;

  return (
    <LeaderTourProvider>
      <Stack
        screenOptions={{
          headerBackTitle: 'Back',
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.ink,
          headerTitleStyle: { ...fonts.bold, color: colors.ink },
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
      <MeetingReminder />
    </LeaderTourProvider>
  );
}
