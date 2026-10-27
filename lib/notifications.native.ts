import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { readSavedAccounts, withSavedAccountClient } from '@/lib/accounts';
import { showAlert } from '@/lib/dialogs';
import {
  notificationTarget,
  type MeetingReminderOptions,
  type NotificationTapOptions,
  type NotificationTarget,
} from '@/lib/notificationRouting';
import { isRemoteConfigured } from '@/lib/supabase';
import type { MeetingInfo } from '@/lib/types';

const CHANNEL_ID = 'default';
const LEGACY_MEETING_REMINDER_ID = 'meeting-reminder';
const TOKEN_STORAGE_KEY = 'go-and-make:push-tokens-by-account';
const reminderId = (userId: string) => `meeting-reminder:${userId}`;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type PendingTap = {
  notification: Notifications.Notification;
  target: NotificationTarget | null;
};

/** Queue cold-start taps until authentication and the correct huddle have loaded. */
export function useNotificationTaps({ ready, userId, accounts, switchAccount }: NotificationTapOptions) {
  const [pending, setPending] = useState<PendingTap | null>(null);
  const [switching, setSwitching] = useState(false);
  const lastResponse = useRef<string | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    function receive(response: Notifications.NotificationResponse) {
      const key = `${response.notification.request.identifier}:${response.notification.date}:${response.actionIdentifier}`;
      if (lastResponse.current === key) return;
      lastResponse.current = key;
      setPending({ notification: response.notification, target: null });
      Notifications.clearLastNotificationResponse();
    }
    const subscription = Notifications.addNotificationResponseReceivedListener(receive);
    const launched = Notifications.getLastNotificationResponse();
    if (launched) receive(launched);
    const tokenSubscription = Notifications.addPushTokenListener(() => {
      enablePushNotifications().catch((error) => console.warn('Push token refresh failed:', error));
    });
    return () => {
      mounted.current = false;
      subscription.remove();
      tokenSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!ready || !pending || switching) return;
    const notification = pending.notification;
    const clearPending = () => {
      setPending((current) => current?.notification === notification ? null : current);
    };
    let target: NotificationTarget;
    try {
      target = notificationTarget(notification.request.content.data, accounts, userId);
    } catch (error) {
      clearPending();
      showAlert('Unable to open notification', error instanceof Error ? error.message : 'Open your huddle from Settings.');
      return;
    }

    if (userId === target.userId) {
      clearPending();
      router.push(target.url as Href);
      return;
    }
    // The switch may resolve before React has committed the restored huddle.
    if (pending.target) return;
    setSwitching(true);
    void switchAccount(target.userId)
      .then(() => {
        if (mounted.current) {
          setPending((current) => current?.notification === notification ? { notification, target } : current);
        }
      })
      .catch(() => {
        if (!mounted.current) return;
        clearPending();
        showAlert('Unable to open notification', 'This account could not be opened. Check your connection, or sign in again using Swap account in Settings.');
      })
      .finally(() => {
        if (mounted.current) setSwitching(false);
      });
  }, [ready, pending, switching, userId, accounts, switchAccount]);
}

let permissionCheck: Promise<boolean> | null = null;
let askedThisSession = false;

function permissionGranted(permission: Notifications.NotificationPermissionsStatus): boolean {
  return permission.granted
    || permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
    || permission.ios?.status === Notifications.IosAuthorizationStatus.EPHEMERAL;
}

/** Prompts at most once per launch; push registration and reminders share that prompt. */
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
    if (permissionGranted(current) || !current.canAskAgain || askedThisSession) return permissionGranted(current);
    askedThisSession = true;
    return permissionGranted(await Notifications.requestPermissionsAsync());
  })().finally(() => {
    permissionCheck = null;
  });
  return permissionCheck;
}

let operations: Promise<unknown> = Promise.resolve();

/** Prevent a registration already in flight from completing after sign-out cleanup. */
function serially<T>(work: () => Promise<T>): Promise<T> {
  const result = operations.then(work, work);
  operations = result.catch(() => {});
  return result;
}

type AccountTokens = Record<string, string[]>;

async function readAccountTokens(): Promise<AccountTokens> {
  const raw = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string[]] => (
    Array.isArray(entry[1]) && entry[1].every((token: unknown) => typeof token === 'string')
  )));
}

async function deviceToken(): Promise<string> {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}

/** Register this device for every saved account, without changing the visible account. */
export function enablePushNotifications(): Promise<void> {
  return serially(async () => {
    if (!isRemoteConfigured) return;
    const accounts = await readSavedAccounts();
    if (!accounts.length || !(await hasPermission())) return;
    const token = await deviceToken();
    const tokens = await readAccountTokens();
    let failure: unknown;
    for (const account of accounts) {
      try {
        await withSavedAccountClient(account.userId, async (client) => {
          const previous = tokens[account.userId] ?? [];
          // Keep the token even if the request's response is lost, for later sign-out cleanup.
          tokens[account.userId] = [...new Set([...previous, token])];
          await AsyncStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
          const { error } = await client.rpc('register_push_token', {
            p_token: token,
            p_platform: Platform.OS === 'ios' ? 'ios' : 'android',
          });
          if (error) throw error;
          for (const oldToken of previous) {
            if (oldToken === token) continue;
            const { error: removalError } = await client.rpc('unregister_push_token', { p_token: oldToken });
            if (removalError) throw removalError;
          }
          tokens[account.userId] = [token];
          await AsyncStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
        });
      } catch (error) {
        // One expired account must not prevent other huddles from receiving notifications.
        failure ??= error;
      }
    }
    if (failure) throw failure;
  });
}

/** Call before removing a saved account; other accounts retain their device registration. */
export function disablePushNotifications(userId: string, onDisabled?: () => Promise<void>): Promise<void> {
  return serially(async () => {
    await cancelAccountReminder(userId);
    if (!isRemoteConfigured) {
      await onDisabled?.();
      return;
    }
    const tokens = await readAccountTokens();
    const registered = tokens[userId] ?? [];
    // Upgrade path: earlier versions kept the token only in memory.
    if (!registered.length && permissionGranted(await Notifications.getPermissionsAsync())) {
      registered.push(await deviceToken());
    }
    if (registered.length) {
      await withSavedAccountClient(userId, async (client) => {
        for (const token of registered) {
          const { error } = await client.rpc('unregister_push_token', { p_token: token });
          if (error) throw error;
        }
      });
    }
    delete tokens[userId];
    await AsyncStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
    // Remove the saved account before any queued refresh can register it again.
    await onDisabled?.();
  });
}

/** A separate weekly reminder for each signed-in account, 24 hours before its meeting. */
export function scheduleMeetingReminder(meetings: MeetingInfo, options: MeetingReminderOptions): Promise<void> {
  return serially(async () => {
    const { userId, huddleId, huddleName, pathwayId, color } = options;
    const account = (await readSavedAccounts()).find((saved) => saved.userId === userId);
    if (!account || account.huddleId !== huddleId) return;
    await cancelAccountReminder(userId);
    if (!meetings.time || !(await hasPermission())) return;
    const meeting = new Date(meetings.time);
    if (Number.isNaN(meeting.getTime())) return;
    const time = meeting.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    await Notifications.scheduleNotificationAsync({
      identifier: reminderId(userId),
      content: {
        title: `${huddleName || 'Huddle'} is tomorrow at ${time}`,
        body: meetings.location ?? undefined,
        color,
        data: {
          url: '/meetings',
          userId,
          huddleId,
          // Read by our expo-notifications patch; falls back to the default icon.
          ...(pathwayId && { icon: `notification_icon_${pathwayId.replace(/-/g, '_')}` }),
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: ((meeting.getDay() + 6) % 7) + 1,
        hour: meeting.getHours(),
        minute: meeting.getMinutes(),
        channelId: CHANNEL_ID,
      },
    });
  });
}

async function cancelAccountReminder(userId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(reminderId(userId));
  // Remove the old single-account identifier once upgraded.
  await Notifications.cancelScheduledNotificationAsync(LEGACY_MEETING_REMINDER_ID);
}

export function cancelMeetingReminder(userId: string): Promise<void> {
  return serially(() => cancelAccountReminder(userId));
}
