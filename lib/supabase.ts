import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** True during Expo web static/SSR render (no DOM). */
const isServer = typeof window === 'undefined';

export const isRemoteConfigured =
  Boolean(supabaseUrl) &&
  Boolean(supabaseAnonKey) &&
  !supabaseUrl.includes('YOUR_PROJECT');

const memoryStorage = {
  getItem: async (_key: string) => null as string | null,
  setItem: async (_key: string, _value: string) => {},
  removeItem: async (_key: string) => {},
};

let client: SupabaseClient | null = null;

if (isRemoteConfigured) {
  client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      // AsyncStorage touches `window` — use a noop store during SSR
      storage: isServer ? memoryStorage : AsyncStorage,
      autoRefreshToken: !isServer,
      persistSession: !isServer,
      detectSessionInUrl: false,
    },
  });
}

export const supabase = client;

export function randomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function generateInviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export const STORAGE_KEYS = {
  session: 'ftk.session',
  profiles: 'ftk.profiles',
  huddles: 'ftk.huddles',
  memberships: 'ftk.memberships',
  progress: 'ftk.progress',
  picks: 'ftk.picks',
};

export async function readJson<T>(key: string, fallback: T): Promise<T> {
  if (isServer) return fallback;
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  if (isServer) return;
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export const platformLabel = Platform.OS;
