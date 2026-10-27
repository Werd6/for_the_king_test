import type { MeetingInfo } from '@/lib/types';

// Browsers get no push notifications or reminders; the native version is notifications.native.ts.

export function useNotificationTaps() {}

export async function enablePushNotifications(): Promise<void> {}

export async function disablePushNotifications(): Promise<void> {}

export async function scheduleMeetingReminder(_meetings: MeetingInfo, _color?: string): Promise<void> {}

export async function cancelMeetingReminder(): Promise<void> {}
