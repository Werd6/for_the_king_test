import type { SavedAccount } from '@/lib/accounts';

export type NotificationTapOptions = {
  ready: boolean;
  userId: string | null;
  accounts: SavedAccount[];
  switchAccount: (userId: string) => Promise<void>;
};

export type MeetingReminderOptions = {
  userId: string;
  huddleId: string;
  huddleName: string;
  pathwayId?: string;
  color?: string;
};

export type NotificationTarget = { userId: string; url: string };

/** Only destinations emitted by our notification sender may open from a push. */
export function notificationDestination(value: unknown): string | null {
  if (value === '/' || value === '/meetings' || value === '/progress') return value;
  if (typeof value === 'string' && /^\/progress\?member=[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(value)) {
    return value;
  }
  return null;
}

export function notificationTarget(
  data: Record<string, unknown> | undefined,
  accounts: SavedAccount[],
  activeUserId: string | null
): NotificationTarget {
  const url = notificationDestination(data?.url);
  if (!url) throw new Error('This notification cannot be opened. Open your huddle from Settings.');

  const recipient = typeof data?.userId === 'string' ? data.userId : null;
  const huddleId = typeof data?.huddleId === 'string' ? data.huddleId : null;
  let account: SavedAccount | undefined;
  if (recipient) {
    account = accounts.find((saved) => saved.userId === recipient);
  } else if (huddleId) {
    const matching = accounts.filter((saved) => saved.huddleId === huddleId);
    account = matching.find((saved) => saved.userId === activeUserId) ?? matching[0];
  } else if (accounts.length === 1) {
    // Older app versions did not include the recipient in notification data.
    account = accounts[0];
  } else {
    throw new Error('This older notification does not identify its huddle. Choose the huddle using Swap account in Settings.');
  }

  if (!account) {
    throw new Error('This account is no longer signed in on this device. Add it using Swap account in Settings to open its huddle.');
  }
  if (huddleId && account.huddleId !== huddleId) {
    throw new Error('This account is no longer in the huddle that sent this notification.');
  }
  return { userId: account.userId, url };
}
