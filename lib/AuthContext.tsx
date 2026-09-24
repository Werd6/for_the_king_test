import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  getCurrentUserId,
  getHuddle,
  getMembershipForUser,
  getProfile,
  signInWithEmail,
  signOut as apiSignOut,
  signUpWithEmail,
} from '@/lib/api';
import { isRemoteConfigured, supabase } from '@/lib/supabase';
import type { Huddle, Profile } from '@/lib/types';

type AuthState = {
  loading: boolean;
  userId: string | null;
  profile: Profile | null;
  huddle: Huddle | null;
  isLeader: boolean;
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  usingLocalMode: boolean;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [huddle, setHuddle] = useState<Huddle | null>(null);

  const refresh = useCallback(async () => {
    const uid = await getCurrentUserId();
    setUserId(uid);
    if (!uid) {
      setProfile(null);
      setHuddle(null);
      return;
    }
    const p = await getProfile(uid);
    setProfile(p);
    const membership = await getMembershipForUser(uid);
    if (membership) {
      const h = await getHuddle(membership.huddle_id);
      setHuddle(h);
    } else {
      setHuddle(null);
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

  const value = useMemo<AuthState>(
    () => ({
      loading,
      userId,
      profile,
      huddle,
      isLeader: Boolean(userId && huddle && huddle.leader_id === userId),
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
        await apiSignOut();
        await refresh();
      },
    }),
    [loading, userId, profile, huddle, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
