import { Redirect, Stack } from 'expo-router';
import { useEffect } from 'react';
import { LeaderTourProvider } from '@/components/LeaderTour';
import { Loading } from '@/components/ui';
import { useAuth } from '@/lib/AuthContext';
import {
  cancelMeetingReminder,
  enablePushNotifications,
  scheduleMeetingReminder,
  useNotificationTaps,
} from '@/lib/notifications';
import { useTheme } from '@/lib/ThemeContext';

export const unstable_settings = { initialRouteName: '(tabs)' };

/** Push registration, the weekly meeting reminder, and opening screens from notification taps. */
function Notifications() {
  const { userId, huddle } = useAuth();
  const { colors } = useTheme();
  const accent = colors.accent;
  const huddleId = huddle?.id;
  const pathwayId = huddle?.pathway_id;
  const meetingTime = huddle?.meetings.time ?? null;
  const meetingLocation = huddle?.meetings.location ?? null;

  useNotificationTaps();

  useEffect(() => {
    if (!userId || !huddleId) return;
    enablePushNotifications().catch((e) => console.warn('Push notifications unavailable:', e));
  }, [userId, huddleId]);

  useEffect(() => {
    if (!userId || !huddleId) return;
    scheduleMeetingReminder(
      { time: meetingTime, location: meetingLocation },
      { pathwayId, color: accent }
    ).catch((e) => console.warn('Could not schedule the meeting reminder:', e));
  }, [userId, huddleId, pathwayId, meetingTime, meetingLocation, accent]);

  useEffect(
    () => () => {
      cancelMeetingReminder().catch(() => {});
    },
    []
  );

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
      <Notifications />
    </LeaderTourProvider>
  );
}
