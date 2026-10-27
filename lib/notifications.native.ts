import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { registerPushToken, unregisterPushToken } from '@/lib/api';
import type { MeetingInfo } from '@/lib/types';

const CHANNEL_ID = 'default';
const MEETING_REMINDER_ID = 'meeting-reminder';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let registeredToken: string | null = null;

/** Opens the screen a notification points at (`data.url`), including the one that launched the app. */
export function useNotificationTaps() {
  useEffect(() => {
    function open(notification: Notifications.Notification) {
      const url = notification.request.content.data?.url;
      if (typeof url === 'string') router.push(url as Href);
    }

    const launched = Notifications.getLastNotificationResponse();
    if (launched) {
      open(launched.notification);
      Notifications.clearLastNotificationResponse();
    }
    const sub = Notifications.addNotificationResponseReceivedListener((r) => open(r.notification));
    return () => sub.remove();
  }, []);
}

let permissionCheck: Promise<boolean> | null = null;
let askedThisSession = false;

/** Prompts at most once per launch; push registration and the reminder share that prompt. */
function hasPermission(): Promise<boolean> {
  permissionCheck ??= (async () => {
    // Android 13+ only shows the permission prompt once a channel exists.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Huddle notifications',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    const current = await Notifications.getPermissionsAsync();
    if (current.granted || !current.canAskAgain || askedThisSession) return current.granted;
    askedThisSession = true;
    return (await Notifications.requestPermissionsAsync()).granted;
  })().finally(() => {
    permissionCheck = null;
  });
  return permissionCheck;
}

/** Asks for permission and saves this device's push token for the signed-in user. */
export async function enablePushNotifications() {
  if (!(await hasPermission())) return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await registerPushToken(token, Platform.OS === 'ios' ? 'ios' : 'android');
  registeredToken = token;
}

/** Stops push notifications to this device for the signed-in user (call before signing out). */
export async function disablePushNotifications() {
  await cancelMeetingReminder();
  if (!registeredToken) return;
  await unregisterPushToken(registeredToken);
  registeredToken = null;
}

/**
 * "Huddle is tomorrow at …", every week, 24 hours before the weekly meeting time.
 * `color` tints it on Android to match the pathway; the icon is always the build's default.
 */
export async function scheduleMeetingReminder(meetings: MeetingInfo, color?: string) {
  await cancelMeetingReminder();
  if (!meetings.time || !(await hasPermission())) return;

  const meeting = new Date(meetings.time);
  const time = meeting.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  await Notifications.scheduleNotificationAsync({
    identifier: MEETING_REMINDER_ID,
    content: {
      title: `Huddle is tomorrow at ${time}`,
      body: meetings.location ?? undefined,
      color,
      data: { url: '/meetings' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      // Weekdays are 1 (Sunday) to 7; the day before the meeting's weekday.
      weekday: ((meeting.getDay() + 6) % 7) + 1,
      hour: meeting.getHours(),
      minute: meeting.getMinutes(),
      channelId: CHANNEL_ID,
    },
  });
}

export async function cancelMeetingReminder() {
  await Notifications.cancelScheduledNotificationAsync(MEETING_REMINDER_ID);
}
