import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import {
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
import { disablePushNotifications } from '@/lib/notifications';
import { isRemoteConfigured, supabase } from '@/lib/supabase';
import type { Huddle, HuddleAccess, Profile } from '@/lib/types';

/** Set after returning from Stripe Checkout on web. */
export type CheckoutReturn = 'confirming' | 'delayed' | 'cancelled' | null;

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
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  usingLocalMode: boolean;
};

const AuthContext = createContext<AuthState | null>(null);

/** Reads and clears `?pass=success|cancelled` from the web URL. */
function takeCheckoutParam(): 'success' | 'cancelled' | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  const pass = url.searchParams.get('pass');
  if (pass !== 'success' && pass !== 'cancelled') return null;
  url.searchParams.delete('pass');
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  return pass;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [huddle, setHuddle] = useState<Huddle | null>(null);
  const [access, setAccess] = useState<HuddleAccess>('none');
  const [checkoutReturn, setCheckoutReturn] = useState<CheckoutReturn>(null);
  const accessRef = useRef<HuddleAccess>('none');

  const loadAccess = useCallback(async (huddleId: string | null) => {
    const next = huddleId ? await getHuddleAccess(huddleId).catch(() => accessRef.current) : 'none';
    accessRef.current = next;
    setAccess(next);
    return next;
  }, []);

  const refresh = useCallback(async () => {
    const uid = await getCurrentUserId();
    setUserId(uid);
    if (!uid) {
      setProfile(null);
      setHuddle(null);
      await loadAccess(null);
      return;
    }
    const p = (await getProfile(uid)) ?? (await restoreMissingProfile());
    setProfile((prev) => (JSON.stringify(prev) === JSON.stringify(p) ? prev : p));
    if (!p && isRemoteConfigured) {
      setHuddle(null);
      await loadAccess(null);
      return;
    }
    const membership = await getMembershipForUser(uid);
    const h = membership ? await getHuddle(membership.huddle_id) : null;
    setHuddle((prev) => (JSON.stringify(prev) === JSON.stringify(h) ? prev : h));
    await loadAccess(h?.id ?? null);
  }, [loadAccess]);

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
      const { data } = supabase.auth.onAuthStateChange(() => {
        refresh();
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

  // Back from Stripe: the webhook may land a few seconds after the redirect, so poll briefly.
  useEffect(() => {
    const param = takeCheckoutParam();
    if (param === 'cancelled') {
      setCheckoutReturn('cancelled');
      return;
    }
    if (param !== 'success') return;
    setCheckoutReturn('confirming');
    let cancelled = false;
    (async () => {
      for (let attempt = 0; attempt < 15 && !cancelled; attempt++) {
        await refresh().catch(() => {});
        if (accessRef.current !== 'unpaid' && accessRef.current !== 'none') {
          if (!cancelled) setCheckoutReturn(null);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      if (!cancelled) setCheckoutReturn('delayed');
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const dismissCheckoutReturn = useCallback(() => setCheckoutReturn(null), []);

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
      refresh,
      usingLocalMode: !isRemoteConfigured,
      signIn: async (email, password) => {
        await signInWithEmail(email, password);
        await refresh();
      },
      signUp: async (email, password, displayName) => {
        await signUpWithEmail(email, password, displayName);
        await refresh();
      },
      signOut: async () => {
        await disablePushNotifications().catch(() => {});
        await apiSignOut();
        await refresh();
      },
    }),
    [loading, userId, profile, huddle, access, checkoutReturn, dismissCheckoutReturn, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
