import type { MeetingInfo } from '@/lib/types';
import type { MeetingReminderOptions, NotificationTapOptions } from '@/lib/notificationRouting';

// Browsers get no push notifications or reminders; the native version is notifications.native.ts.

export function useNotificationTaps(_options: NotificationTapOptions) {}

export async function enablePushNotifications(): Promise<void> {}

export async function disablePushNotifications(_userId: string, onDisabled?: () => Promise<void>): Promise<void> {
  await onDisabled?.();
}

export async function scheduleMeetingReminder(
  _meetings: MeetingInfo,
  _options: MeetingReminderOptions
): Promise<void> {}

export async function cancelMeetingReminder(_userId: string): Promise<void> {}
