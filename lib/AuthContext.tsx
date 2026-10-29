import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import {
  activateSavedAccount,
  forgetAccount,
  readSavedAccounts,
  rememberCurrentAccount,
  rememberSession,
  type SavedAccount,
} from '@/lib/accounts';
import {
  deleteAccount,
  getCurrentUserId,
  getHuddle,
  getHuddleAccess,
  getMembershipForUser,
  getProfile,
  restoreMissingProfile,
  signInWithEmail,
  signOut as apiSignOut,
  signUpWithEmail,
} from '@/lib/api';
import { cancelMeetingReminder, disablePushNotifications } from '@/lib/notifications';
import { isRemoteConfigured, supabase } from '@/lib/supabase';
import type { Huddle, HuddleAccess, Profile } from '@/lib/types';

/**
 * After opening a Payment Link. 'confirming': checking for the pass. 'unconfirmed': checkout is
 * open elsewhere, or closed without a pass showing up yet (paid moments ago, or cancelled).
 */
export type CheckoutReturn = 'confirming' | 'unconfirmed' | null;

type AuthState = {
  loading: boolean;
  userId: string | null;
  profile: Profile | null;
  huddle: Huddle | null;
  isLeader: boolean;
  /** Huddle Pass status for the signed-in user. */
  access: HuddleAccess;
  /** Check-ins, notes and advancing weeks are allowed. */
  canEdit: boolean;
  checkoutReturn: CheckoutReturn;
  dismissCheckoutReturn: () => void;
  /** Checkout opened in a tab or browser that doesn't report back. */
  checkoutOpened: () => void;
  /** Polls for the pass after checkout; the webhook can land a few seconds after payment. */
  confirmCheckout: () => Promise<void>;
  /** Accounts signed in on this device, for Swap account. Includes the current one. */
  savedAccounts: SavedAccount[];
  /** Makes a saved account the current one; the others stay signed in. */
  switchAccount: (userId: string) => Promise<void>;
  refresh: () => Promise<void>;
  /** Signing in or up while signed in adds the account; the previous one stays saved. */
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  /** Signs out the current account and opens the next saved one, if any. */
  signOut: () => Promise<void>;
  deleteCurrentAccount: () => Promise<void>;
  usingLocalMode: boolean;
};

/** Saves the latest tokens of the current account before another account takes over. */
async function snapshotSession() {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  if (data.session) await rememberSession(data.session);
}

/** After the current account is gone, opens the next saved account if there is one. */
async function openNextAccount(removedId: string | null) {
  const next = (await readSavedAccounts().catch(() => [])).find((a) => a.userId !== removedId);
  if (!next) return;
  try {
    await activateSavedAccount(next.userId);
  } catch (e) {
    // Its sign-in expired; it stays listed under Swap account with "Sign in again".
    console.warn('Could not open the next saved account', e);
  }
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [huddle, setHuddle] = useState<Huddle | null>(null);
  const [access, setAccess] = useState<HuddleAccess>('none');
  const [checkoutReturn, setCheckoutReturn] = useState<CheckoutReturn>(null);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const accessRef = useRef<HuddleAccess>('none');
  const huddleIdRef = useRef<string | null>(null);
  const refreshSeq = useRef(0);
  /** Set while swapping or signing out, so intermediate auth events don't flash other screens. */
  const changingAccount = useRef(false);

  const changeAccount = useCallback(async (work: () => Promise<void>) => {
    changingAccount.current = true;
    refreshSeq.current++;
    try {
      await work();
    } finally {
      changingAccount.current = false;
    }
  }, []);

  // Loads everything first and commits it together, so screens never see one account's id
  // with another account's huddle. A newer refresh (e.g. after a swap) wins.
  const refresh = useCallback(async () => {
    const seq = ++refreshSeq.current;
    const uid = await getCurrentUserId();
    let p: Profile | null = null;
    let h: Huddle | null = null;
    let a: HuddleAccess = 'none';
    if (uid) {
      p = (await getProfile(uid)) ?? (await restoreMissingProfile());
      if (p || !isRemoteConfigured) {
        const membership = await getMembershipForUser(uid);
        h = membership ? await getHuddle(membership.huddle_id) : null;
      }
      if (h) {
        const hid = h.id;
        a = await getHuddleAccess(hid).catch(() =>
          huddleIdRef.current === hid ? accessRef.current : 'none'
        );
      }
    }
    if (seq !== refreshSeq.current) return;

    setUserId(uid);
    setProfile((prev) => (JSON.stringify(prev) === JSON.stringify(p) ? prev : p));
    setHuddle((prev) => (JSON.stringify(prev) === JSON.stringify(h) ? prev : h));
    huddleIdRef.current = h?.id ?? null;
    accessRef.current = a;
    setAccess(a);

    if (p) await rememberCurrentAccount(p, h).catch((e) => console.warn('Could not save account', e));
    const accounts = await readSavedAccounts().catch(() => []);
    if (seq === refreshSeq.current) {
      setSavedAccounts((prev) => (JSON.stringify(prev) === JSON.stringify(accounts) ? prev : accounts));
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await refresh();
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    if (isRemoteConfigured && supabase) {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        // Keeps saved accounts' tokens current; never re-adds a signed-out account.
        if (session) rememberSession(session).catch(() => {});
        if (!changingAccount.current) refresh();
      });
      return () => {
        mounted = false;
        data.subscription.unsubscribe();
      };
    }
    return () => {
      mounted = false;
    };
  }, [refresh]);

  // Passes and the access window change outside the app (payments, expiry), so recheck on focus.
  useEffect(() => {
    if (!isRemoteConfigured) return;
    const recheck = () => {
      refresh().catch(() => {});
    };
    if (Platform.OS === 'web') {
      const onVisible = () => {
        if (document.visibilityState === 'visible') recheck();
      };
      document.addEventListener('visibilitychange', onVisible);
      return () => document.removeEventListener('visibilitychange', onVisible);
    }
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') recheck();
    });
    return () => sub.remove();
  }, [refresh]);

  const confirmSeq = useRef(0);
  const confirmCheckout = useCallback(async () => {
    const seq = ++confirmSeq.current;
    setCheckoutReturn('confirming');
    for (let attempt = 0; attempt < 5; attempt++) {
      await refresh().catch(() => {});
      if (seq !== confirmSeq.current) return;
      if (accessRef.current !== 'unpaid' && accessRef.current !== 'none') {
        setCheckoutReturn(null);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    if (seq === confirmSeq.current) setCheckoutReturn('unconfirmed');
  }, [refresh]);

  const checkoutOpened = useCallback(() => {
    confirmSeq.current++;
    setCheckoutReturn('unconfirmed');
  }, []);

  const dismissCheckoutReturn = useCallback(() => {
    confirmSeq.current++;
    setCheckoutReturn(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      userId,
      profile,
      huddle,
      isLeader: Boolean(userId && huddle && huddle.leader_id === userId),
      access,
      canEdit: access === 'active' || access === 'exempt',
      checkoutReturn,
      dismissCheckoutReturn,
      checkoutOpened,
      confirmCheckout,
      savedAccounts,
      switchAccount: async (id) => {
        await changeAccount(() => activateSavedAccount(id));
        await refresh();
      },
      refresh,
      usingLocalMode: !isRemoteConfigured,
      signIn: async (email, password) => {
        await snapshotSession();
        await signInWithEmail(email, password);
        await refresh();
      },
      signUp: async (email, password, displayName) => {
        await snapshotSession();
        await signUpWithEmail(email, password, displayName);
        await refresh();
      },
      signOut: async () => {
        const id = userId;
        try {
          await changeAccount(async () => {
            if (id) {
              // Stops this account's notifications on this device; other accounts keep theirs.
              await disablePushNotifications(id, () => forgetAccount(id)).catch(async (e) => {
                console.warn('Could not turn off notifications for this account', e);
                await forgetAccount(id);
              });
            }
            await apiSignOut();
            await openNextAccount(id);
          });
        } finally {
          await refresh();
        }
      },
      deleteCurrentAccount: async () => {
        const id = userId;
        if (!id) return;
        try {
          await changeAccount(async () => {
            await deleteAccount(id);
            await cancelMeetingReminder(id).catch(() => {});
            await forgetAccount(id);
            await openNextAccount(id);
          });
        } finally {
          await refresh();
        }
      },
    }),
    [
      loading,
      userId,
      profile,
      huddle,
      access,
      checkoutReturn,
      dismissCheckoutReturn,
      checkoutOpened,
      confirmCheckout,
      savedAccounts,
      changeAccount,
      refresh,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
