import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { authStorage } from '@/lib/authStorage';
import {
  accountStorageKey,
  createAccountClient,
  isRemoteConfigured,
  readJson,
  STORAGE_KEYS,
  supabase,
  writeJson,
} from '@/lib/supabase';
import type { Huddle, Profile } from '@/lib/types';

/** Display-only account information: credentials never leave this module. */
export type SavedAccount = {
  userId: string;
  email: string | null;
  displayName: string;
  huddleId: string | null;
  huddleName: string | null;
  isLeader: boolean;
};

type Credentials = Pick<Session, 'access_token' | 'refresh_token'>;
type StoredAccount = { account: SavedAccount; credentials?: Credentials };
let vaultQueue: Promise<unknown> = Promise.resolve();
let accountQueue: Promise<unknown> = Promise.resolve();

function withVault<T>(operation: () => Promise<T>): Promise<T> {
  const result = vaultQueue.then(operation, operation);
  vaultQueue = result.then(() => {}, () => {});
  return result;
}

function withAccountOperation<T>(operation: () => Promise<T>): Promise<T> {
  const result = accountQueue.then(operation, operation);
  accountQueue = result.then(() => {}, () => {});
  return result;
}

async function readVault(): Promise<StoredAccount[]> {
  const raw = await authStorage.getItem(accountStorageKey);
  if (!raw) return [];
  const value = JSON.parse(raw) as StoredAccount[];
  if (!Array.isArray(value) || value.some((entry) => !entry?.account?.userId)) {
    throw new Error('Saved accounts could not be read.');
  }
  return value;
}

async function writeVault(accounts: StoredAccount[]): Promise<void> {
  if (accounts.length === 0) await authStorage.removeItem(accountStorageKey);
  else await authStorage.setItem(accountStorageKey, JSON.stringify(accounts));
}

function credentialsFor(session: Session): Credentials {
  return { access_token: session.access_token, refresh_token: session.refresh_token };
}

export function readSavedAccounts(): Promise<SavedAccount[]> {
  return withVault(async () => (await readVault()).map(({ account }) => ({ ...account })));
}

export async function rememberCurrentAccount(profile: Profile, huddle: Huddle | null): Promise<void> {
  let credentials: Credentials | undefined;
  if (isRemoteConfigured && supabase) {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    // A refresh for the previous account may finish after another account signed in.
    if (data.session?.user.id !== profile.id) return;
    credentials = credentialsFor(data.session);
  } else {
    const session = await readJson<{ userId: string } | null>(STORAGE_KEYS.session, null);
    if (session?.userId !== profile.id) return;
  }
  await withVault(async () => {
    const accounts = await readVault();
    const next: StoredAccount = {
      account: {
        userId: profile.id,
        email: profile.email,
        displayName: profile.display_name,
        huddleId: huddle?.id ?? null,
        huddleName: huddle?.name ?? null,
        isLeader: huddle?.leader_id === profile.id,
      },
      ...(credentials ? { credentials } : {}),
    };
    const index = accounts.findIndex(({ account }) => account.userId === profile.id);
    if (index < 0) accounts.push(next);
    else {
      if (JSON.stringify(accounts[index]) === JSON.stringify(next)) return;
      accounts[index] = next;
    }
    await writeVault(accounts);
  });
}

/** Auth refresh events update tokens, but must never resurrect a signed-out account. */
export function rememberSession(session: Session): Promise<void> {
  return withVault(async () => {
    const accounts = await readVault();
    const entry = accounts.find(({ account }) => account.userId === session.user.id);
    if (!entry) return;
    if (entry.credentials?.access_token === session.access_token &&
      entry.credentials?.refresh_token === session.refresh_token) return;
    entry.credentials = credentialsFor(session);
    await writeVault(accounts);
  });
}

export function forgetAccount(userId: string): Promise<void> {
  return withAccountOperation(() => withVault(async () => {
    const accounts = await readVault();
    const remaining = accounts.filter(({ account }) => account.userId !== userId);
    if (remaining.length !== accounts.length) await writeVault(remaining);
  }));
}

async function requireAccount(userId: string): Promise<StoredAccount> {
  return withVault(async () => {
    const entry = (await readVault()).find(({ account }) => account.userId === userId);
    if (!entry) throw new Error('This account is no longer signed in on this device.');
    return entry;
  });
}

async function restoreClient(client: SupabaseClient, entry: StoredAccount): Promise<Session> {
  if (!entry.credentials) throw new Error('Please sign in to this account again.');
  const { data, error } = await client.auth.setSession(entry.credentials);
  if (error) throw error;
  if (!data.session || data.session.user.id !== entry.account.userId) {
    throw new Error('Please sign in to this account again.');
  }
  await rememberSession(data.session);
  return data.session;
}

/** Validate in isolation before touching the active session; keep the previous login on failure. */
export function activateSavedAccount(userId: string): Promise<void> {
  return withAccountOperation(async () => {
    const entry = await requireAccount(userId);
    if (!isRemoteConfigured || !supabase) {
      const profiles = await readJson<Profile[]>(STORAGE_KEYS.profiles, []);
      if (!profiles.some((profile) => profile.id === userId)) {
        throw new Error('This local account no longer exists.');
      }
      await writeJson(STORAGE_KEYS.session, { userId, email: entry.account.email });
      return;
    }
    const { data: current, error: currentError } = await supabase.auth.getSession();
    if (currentError) throw currentError;
    if (current.session?.user.id === userId) {
      await rememberSession(current.session);
      return;
    }
    if (current.session) await rememberSession(current.session);
    const isolated = createAccountClient();
    const target = await restoreClient(isolated, entry);
    // Validation can take time; capture any refresh that happened while it was in flight.
    const { data: previous, error: previousError } = await supabase.auth.getSession();
    if (previousError) throw previousError;
    if (previous.session) await rememberSession(previous.session);
    try {
      const { data, error } = await supabase.auth.setSession(credentialsFor(target));
      if (error) throw error;
      if (!data.session || data.session.user.id !== userId) throw new Error('Unable to switch accounts.');
      await rememberSession(data.session);
    } catch (error) {
      if (previous.session) {
        const { data, error: rollbackError } = await supabase.auth.setSession(credentialsFor(previous.session));
        if (rollbackError) throw new Error('Unable to switch accounts. Please select your previous account again.');
        if (data.session) await rememberSession(data.session);
      } else {
        await supabase.auth.signOut({ scope: 'local' });
      }
      throw error;
    }
  });
}

/** Run account-specific requests without changing the huddle currently shown in the app. */
export function withSavedAccountClient<T>(
  userId: string,
  callback: (client: SupabaseClient) => Promise<T>
): Promise<T> {
  return withAccountOperation(async () => {
    const entry = await requireAccount(userId);
    if (!isRemoteConfigured || !supabase) throw new Error('Cloud accounts are not configured.');
    // Snapshot active refreshes before constructing another client for the same account.
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (data.session?.user.id === userId) {
      await rememberSession(data.session);
      // This clone uses the refreshed access token without owning/rotating its refresh token.
      // It also keeps requests on this account if the app signs into another account meanwhile.
      return callback(createAccountClient(data.session.access_token));
    }
    const isolated = createAccountClient();
    await restoreClient(isolated, entry);
    try {
      return await callback(isolated);
    } finally {
      const { data: latest } = await isolated.auth.getSession();
      if (latest.session?.user.id === userId) await rememberSession(latest.session);
    }
  });
}
