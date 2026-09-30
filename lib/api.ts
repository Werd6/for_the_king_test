import { isLocalVersionId } from '@/lib/content';
import { authRedirectUrl } from '@/lib/siteUrl';
import {
  generateInviteCode,
  isRemoteConfigured,
  randomId,
  readJson,
  STORAGE_KEYS,
  supabase,
  writeJson,
} from '@/lib/supabase';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type {
  Huddle,
  HuddleSettings,
  JournalNote,
  JournalPhoto,
  MeetingInfo,
  Membership,
  Profile,
  ProgressRow,
  WeekPick,
} from '@/lib/types';

export function emptyMeeting(): MeetingInfo {
  return { time: null, location: null };
}

/** Accepts new {time,location} or legacy weekly ISO array. */
export function normalizeMeetings(raw: unknown): MeetingInfo {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    return {
      time: typeof o.time === 'string' ? o.time : null,
      location: typeof o.location === 'string' ? o.location : null,
    };
  }
  if (Array.isArray(raw)) {
    const first = raw.find((x): x is string => typeof x === 'string');
    return { time: first ?? null, location: null };
  }
  return emptyMeeting();
}

export const DEFAULT_HUDDLE_SETTINGS: HuddleSettings = {
  requireNotes: false,
  notesVisibility: 'private',
};

export function normalizeSettings(raw: unknown): HuddleSettings {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    requireNotes: o.requireNotes === true,
    notesVisibility: o.notesVisibility === 'shared' ? 'shared' : 'private',
  };
}

function normalizeHuddle(
  raw: Omit<Huddle, 'meetings' | 'settings'> & { meetings: unknown; settings?: unknown }
): Huddle {
  return { ...raw, meetings: normalizeMeetings(raw.meetings), settings: normalizeSettings(raw.settings) };
}

type LocalSession = {
  userId: string;
  email: string | null;
};

async function getLocalSession(): Promise<LocalSession | null> {
  return readJson<LocalSession | null>(STORAGE_KEYS.session, null);
}

async function setLocalSession(session: LocalSession | null) {
  if (!session) {
    await writeJson(STORAGE_KEYS.session, null);
    return;
  }
  await writeJson(STORAGE_KEYS.session, session);
}

export async function getCurrentUserId(): Promise<string | null> {
  if (isRemoteConfigured && supabase) {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  }
  const session = await getLocalSession();
  return session?.userId ?? null;
}

export async function signUpWithEmail(email: string, password: string, displayName: string) {
  if (isRemoteConfigured && supabase) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName }, emailRedirectTo: authRedirectUrl('/') },
    });
    if (error) throw error;

    // Supabase hides existing accounts: no error, no session, no email, and an empty identities list.
    if (data.user && !data.session && data.user.identities?.length === 0) {
      throw new Error(
        'An account with this email already exists. Sign in instead, or use Forgot password.'
      );
    }

    // Profile row is created by the auth trigger. Only update when we have a session
    // (upsert without a session fails RLS and looked like "nothing happened" on web).
    if (data.session && data.user) {
      const { error: profileErr } = await supabase.from('profiles').upsert({
        id: data.user.id,
        display_name: displayName,
        email,
      });
      if (profileErr) throw profileErr;
    }

    if (!data.session) {
      throw new Error(
        'Account created. Check your email (and spam folder) for a confirmation link, then sign in.'
      );
    }
    return data;
  }

  const profiles = await readJson<Profile[]>(STORAGE_KEYS.profiles, []);
  if (profiles.some((p) => p.email?.toLowerCase() === email.toLowerCase())) {
    throw new Error('An account with this email already exists (local mode).');
  }
  const id = randomId();
  const profile: Profile = {
    id,
    display_name: displayName.trim() || 'Brother',
    email,
    created_at: new Date().toISOString(),
  };
  await writeJson(STORAGE_KEYS.profiles, [...profiles, profile]);
  await setLocalSession({ userId: id, email });
  return { user: { id } };
}

export async function signInWithEmail(email: string, password: string) {
  if (isRemoteConfigured && supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  // Local prototype: password ignored; find or create by email
  const profiles = await readJson<Profile[]>(STORAGE_KEYS.profiles, []);
  let profile = profiles.find((p) => p.email?.toLowerCase() === email.toLowerCase());
  if (!profile) {
    throw new Error('No local account found. Sign up first.');
  }
  void password;
  await setLocalSession({ userId: profile.id, email: profile.email });
  return { user: { id: profile.id } };
}

export async function requestPasswordReset(email: string, redirectTo: string) {
  if (!isRemoteConfigured || !supabase) {
    throw new Error('Password reset is only available with cloud sync.');
  }
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

export async function updatePassword(password: string) {
  if (!isRemoteConfigured || !supabase) {
    throw new Error('Password reset is only available with cloud sync.');
  }
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function signOut() {
  if (isRemoteConfigured && supabase) {
    await supabase.auth.signOut();
    return;
  }
  await setLocalSession(null);
}

export async function getProfile(userId: string): Promise<Profile | null> {
  if (isRemoteConfigured && supabase) {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) throw error;
    return data;
  }
  const profiles = await readJson<Profile[]>(STORAGE_KEYS.profiles, []);
  return profiles.find((p) => p.id === userId) ?? null;
}

export async function updateDisplayName(userId: string, displayName: string) {
  if (isRemoteConfigured && supabase) {
    const { error } = await supabase.from('profiles').update({ display_name: displayName }).eq('id', userId);
    if (error) throw error;
    return;
  }
  const profiles = await readJson<Profile[]>(STORAGE_KEYS.profiles, []);
  const next = profiles.map((p) => (p.id === userId ? { ...p, display_name: displayName } : p));
  await writeJson(STORAGE_KEYS.profiles, next);
}

export async function deleteAccount(userId: string) {
  if (isRemoteConfigured && supabase) {
    // Storage files don't cascade with database rows, so remove them first.
    const membership = await getMembershipForUser(userId);
    const huddle = membership ? await getHuddle(membership.huddle_id) : null;
    if (huddle?.leader_id === userId) await removeHuddlePhotoFiles(huddle.id);
    await removeOwnPhotoFiles(userId);

    const { error } = await supabase.rpc('delete_my_account');
    if (error) throw new Error(error.message);
    // The auth user is gone, so the server-side sign-out call can fail; clear locally.
    await supabase.auth.signOut({ scope: 'local' });
    return;
  }

  const membership = await getMembershipForUser(userId);
  if (membership) {
    const huddle = await getHuddle(membership.huddle_id);
    if (huddle?.leader_id === userId) {
      await dissolveHuddle(huddle.id);
    } else {
      await leaveHuddle(userId);
    }
  }
  const notes = await readJson<JournalNote[]>(STORAGE_KEYS.journalNotes, []);
  const photos = await readJson<JournalPhoto[]>(STORAGE_KEYS.journalPhotos, []);
  await writeJson(STORAGE_KEYS.journalNotes, notes.filter((n) => n.user_id !== userId));
  await writeJson(STORAGE_KEYS.journalPhotos, photos.filter((p) => p.user_id !== userId));
  const profiles = await readJson<Profile[]>(STORAGE_KEYS.profiles, []);
  await writeJson(
    STORAGE_KEYS.profiles,
    profiles.filter((p) => p.id !== userId)
  );
  await setLocalSession(null);
}

function buildMeeting(timeIso: string | null, location: string | null): MeetingInfo {
  const loc = location?.trim() || null;
  return { time: timeIso, location: loc };
}

export async function createHuddle(params: {
  leaderId: string;
  displayName: string;
  pathwayId: string;
  pathwayVersionId: string;
  totalWeeks: number;
  meetingTimeIso: string | null;
  meetingLocation: string | null;
}): Promise<Huddle> {
  const meetings = buildMeeting(params.meetingTimeIso, params.meetingLocation);
  const huddle: Huddle = {
    id: randomId(),
    name: `${params.displayName}'s Huddle`,
    invite_code: generateInviteCode(),
    leader_id: params.leaderId,
    pathway_id: params.pathwayId,
    pathway_version_id: params.pathwayVersionId,
    current_week: 1,
    meetings,
    settings: DEFAULT_HUDDLE_SETTINGS,
    created_at: new Date().toISOString(),
  };

  if (isRemoteConfigured && supabase) {
    if (isLocalVersionId(params.pathwayVersionId)) {
      throw new Error('No pathway is available yet. Please try again later.');
    }
    const { data, error } = await supabase
      .from('huddles')
      .insert({
        name: huddle.name,
        invite_code: huddle.invite_code,
        leader_id: huddle.leader_id,
        pathway_id: huddle.pathway_id,
        pathway_version_id: huddle.pathway_version_id,
        current_week: 1,
        meetings: huddle.meetings,
      })
      .select('*')
      .single();
    if (error) throw error;
    const { error: memErr } = await supabase.from('memberships').insert({
      huddle_id: data.id,
      user_id: params.leaderId,
    });
    if (memErr) throw memErr;
    return normalizeHuddle(data as Huddle);
  }

  const existing = await getMembershipForUser(params.leaderId);
  if (existing) throw new Error('You are already in a huddle.');

  const huddles = await readJson<Huddle[]>(STORAGE_KEYS.huddles, []);
  const memberships = await readJson<Membership[]>(STORAGE_KEYS.memberships, []);
  await writeJson(STORAGE_KEYS.huddles, [...huddles, huddle]);
  await writeJson(STORAGE_KEYS.memberships, [
    ...memberships,
    {
      id: randomId(),
      huddle_id: huddle.id,
      user_id: params.leaderId,
      joined_at: new Date().toISOString(),
    },
  ]);
  return huddle;
}

export async function joinHuddleByCode(userId: string, code: string): Promise<Huddle> {
  const normalized = code.trim().toUpperCase();

  if (isRemoteConfigured && supabase) {
    const { data: huddle, error } = await supabase
      .rpc('join_huddle_by_code', { p_code: normalized })
      .single();
    if (error) throw new Error(error.message);
    return normalizeHuddle(huddle as Huddle);
  }

  const existing = await getMembershipForUser(userId);
  if (existing) throw new Error('You are already in a huddle.');

  const huddles = await readJson<Huddle[]>(STORAGE_KEYS.huddles, []);
  const huddle = huddles.find((h) => h.invite_code === normalized);
  if (!huddle) throw new Error('Invalid invite code.');

  const memberships = await readJson<Membership[]>(STORAGE_KEYS.memberships, []);
  await writeJson(STORAGE_KEYS.memberships, [
    ...memberships,
    {
      id: randomId(),
      huddle_id: huddle.id,
      user_id: userId,
      joined_at: new Date().toISOString(),
    },
  ]);
  return normalizeHuddle(huddle);
}

export async function getMembershipForUser(userId: string): Promise<Membership | null> {
  if (isRemoteConfigured && supabase) {
    const { data, error } = await supabase
      .from('memberships')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }
  const memberships = await readJson<Membership[]>(STORAGE_KEYS.memberships, []);
  return memberships.find((m) => m.user_id === userId) ?? null;
}

export async function getHuddle(huddleId: string): Promise<Huddle | null> {
  if (isRemoteConfigured && supabase) {
    const { data, error } = await supabase.from('huddles').select('*').eq('id', huddleId).maybeSingle();
    if (error) throw error;
    return data ? normalizeHuddle(data as Huddle) : null;
  }
  const huddles = await readJson<Huddle[]>(STORAGE_KEYS.huddles, []);
  const found = huddles.find((h) => h.id === huddleId);
  return found ? normalizeHuddle(found) : null;
}

export async function getHuddleMembers(huddleId: string): Promise<Profile[]> {
  if (isRemoteConfigured && supabase) {
    const { data: mems, error } = await supabase
      .from('memberships')
      .select('user_id')
      .eq('huddle_id', huddleId);
    if (error) throw error;
    const ids = (mems ?? []).map((m) => m.user_id);
    if (!ids.length) return [];
    const { data: profiles, error: pErr } = await supabase.from('profiles').select('*').in('id', ids);
    if (pErr) throw pErr;
    return profiles ?? [];
  }
  const memberships = await readJson<Membership[]>(STORAGE_KEYS.memberships, []);
  const profiles = await readJson<Profile[]>(STORAGE_KEYS.profiles, []);
  const ids = new Set(memberships.filter((m) => m.huddle_id === huddleId).map((m) => m.user_id));
  return profiles.filter((p) => ids.has(p.id));
}

export async function advanceWeek(huddleId: string, leaderId: string, totalWeeks = 20) {
  const huddle = await getHuddle(huddleId);
  if (!huddle) throw new Error('Huddle not found.');
  if (huddle.leader_id !== leaderId) throw new Error('Only the leader can advance the week.');
  if (huddle.current_week >= totalWeeks) {
    throw new Error(`Already on week ${totalWeeks}.`);
  }

  const next = huddle.current_week + 1;
  if (isRemoteConfigured && supabase) {
    const { error } = await supabase.from('huddles').update({ current_week: next }).eq('id', huddleId);
    if (error) throw error;
    return;
  }
  const huddles = await readJson<Huddle[]>(STORAGE_KEYS.huddles, []);
  await writeJson(
    STORAGE_KEYS.huddles,
    huddles.map((h) => (h.id === huddleId ? { ...h, current_week: next } : h))
  );
}

export async function updateMeetingInfo(
  huddleId: string,
  leaderId: string,
  meeting: MeetingInfo
) {
  const huddle = await getHuddle(huddleId);
  if (!huddle) throw new Error('Huddle not found.');
  if (huddle.leader_id !== leaderId) throw new Error('Only the leader can change meetings.');
  const meetings = buildMeeting(meeting.time, meeting.location);

  if (isRemoteConfigured && supabase) {
    const { error } = await supabase.from('huddles').update({ meetings }).eq('id', huddleId);
    if (error) throw error;
    return;
  }
  const huddles = await readJson<Huddle[]>(STORAGE_KEYS.huddles, []);
  await writeJson(
    STORAGE_KEYS.huddles,
    huddles.map((h) => (h.id === huddleId ? { ...h, meetings } : h))
  );
}

export async function leaveHuddle(userId: string) {
  const membership = await getMembershipForUser(userId);
  if (!membership) return;
  const huddle = await getHuddle(membership.huddle_id);
  if (huddle?.leader_id === userId) {
    throw new Error('Leaders must dissolve the huddle instead of leaving.');
  }

  if (isRemoteConfigured && supabase) {
    const { error } = await supabase.from('memberships').delete().eq('user_id', userId);
    if (error) throw error;
    return;
  }
  const memberships = await readJson<Membership[]>(STORAGE_KEYS.memberships, []);
  await writeJson(
    STORAGE_KEYS.memberships,
    memberships.filter((m) => m.user_id !== userId)
  );
}

export async function dissolveHuddle(huddleId: string) {
  if (isRemoteConfigured && supabase) {
    await removeHuddlePhotoFiles(huddleId);
    const { error } = await supabase.from('huddles').delete().eq('id', huddleId);
    if (error) throw error;
    return;
  }
  const huddles = await readJson<Huddle[]>(STORAGE_KEYS.huddles, []);
  const memberships = await readJson<Membership[]>(STORAGE_KEYS.memberships, []);
  const progress = await readJson<ProgressRow[]>(STORAGE_KEYS.progress, []);
  const picks = await readJson<WeekPick[]>(STORAGE_KEYS.picks, []);
  await writeJson(
    STORAGE_KEYS.huddles,
    huddles.filter((h) => h.id !== huddleId)
  );
  await writeJson(
    STORAGE_KEYS.memberships,
    memberships.filter((m) => m.huddle_id !== huddleId)
  );
  await writeJson(
    STORAGE_KEYS.progress,
    progress.filter((p) => p.huddle_id !== huddleId)
  );
  await writeJson(
    STORAGE_KEYS.picks,
    picks.filter((p) => p.huddle_id !== huddleId)
  );
  const notes = await readJson<JournalNote[]>(STORAGE_KEYS.journalNotes, []);
  const photos = await readJson<JournalPhoto[]>(STORAGE_KEYS.journalPhotos, []);
  const noteIds = new Set(notes.filter((n) => n.huddle_id === huddleId).map((n) => n.id));
  await writeJson(STORAGE_KEYS.journalNotes, notes.filter((n) => !noteIds.has(n.id)));
  await writeJson(STORAGE_KEYS.journalPhotos, photos.filter((p) => !noteIds.has(p.note_id)));
}

export async function getProgressForWeek(huddleId: string, week: number): Promise<ProgressRow[]> {
  if (isRemoteConfigured && supabase) {
    const { data, error } = await supabase
      .from('progress')
      .select('*')
      .eq('huddle_id', huddleId)
      .eq('week', week);
    if (error) throw error;
    return data ?? [];
  }
  const progress = await readJson<ProgressRow[]>(STORAGE_KEYS.progress, []);
  return progress.filter((p) => p.huddle_id === huddleId && p.week === week);
}

export async function setProgress(params: {
  huddleId: string;
  userId: string;
  week: number;
  itemId: string;
  completed: boolean;
}) {
  if (isRemoteConfigured && supabase) {
    if (params.completed) {
      const { error } = await supabase.from('progress').upsert(
        {
          huddle_id: params.huddleId,
          user_id: params.userId,
          week: params.week,
          item_id: params.itemId,
          completed_at: new Date().toISOString(),
        },
        { onConflict: 'huddle_id,user_id,week,item_id' }
      );
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('progress')
        .delete()
        .eq('huddle_id', params.huddleId)
        .eq('user_id', params.userId)
        .eq('week', params.week)
        .eq('item_id', params.itemId);
      if (error) throw error;
    }
    return;
  }

  const progress = await readJson<ProgressRow[]>(STORAGE_KEYS.progress, []);
  const filtered = progress.filter(
    (p) =>
      !(
        p.huddle_id === params.huddleId &&
        p.user_id === params.userId &&
        p.week === params.week &&
        p.item_id === params.itemId
      )
  );
  if (params.completed) {
    filtered.push({
      id: randomId(),
      huddle_id: params.huddleId,
      user_id: params.userId,
      week: params.week,
      item_id: params.itemId,
      completed_at: new Date().toISOString(),
    });
  }
  await writeJson(STORAGE_KEYS.progress, filtered);
}

export async function getWeekPick(huddleId: string, week: number): Promise<WeekPick | null> {
  if (isRemoteConfigured && supabase) {
    const { data, error } = await supabase
      .from('huddle_week_picks')
      .select('*')
      .eq('huddle_id', huddleId)
      .eq('week', week)
      .maybeSingle();
    if (error) throw error;
    return data;
  }
  const picks = await readJson<WeekPick[]>(STORAGE_KEYS.picks, []);
  return picks.find((p) => p.huddle_id === huddleId && p.week === week) ?? null;
}

export async function setWeekPick(params: {
  huddleId: string;
  week: number;
  optionId: string;
  leaderId: string;
}) {
  const huddle = await getHuddle(params.huddleId);
  if (!huddle || huddle.leader_id !== params.leaderId) {
    throw new Error('Only the leader can pick the group activity.');
  }

  const pick: WeekPick = {
    huddle_id: params.huddleId,
    week: params.week,
    option_id: params.optionId,
    picked_by: params.leaderId,
    picked_at: new Date().toISOString(),
  };

  if (isRemoteConfigured && supabase) {
    const { error } = await supabase.from('huddle_week_picks').upsert(pick);
    if (error) throw error;
    return;
  }

  const picks = await readJson<WeekPick[]>(STORAGE_KEYS.picks, []);
  const next = picks.filter((p) => !(p.huddle_id === params.huddleId && p.week === params.week));
  next.push(pick);
  await writeJson(STORAGE_KEYS.picks, next);
}

// -----------------------------------------------------------------------------
// Huddle settings + journal notes
// -----------------------------------------------------------------------------

const JOURNAL_BUCKET = 'journal';
const PHOTO_MAX_WIDTH = 1600;

export async function updateHuddleSettings(
  huddleId: string,
  leaderId: string,
  patch: Partial<HuddleSettings>
): Promise<HuddleSettings> {
  const huddle = await getHuddle(huddleId);
  if (!huddle) throw new Error('Huddle not found.');
  if (huddle.leader_id !== leaderId) throw new Error('Only the leader can change huddle settings.');
  const settings = { ...huddle.settings, ...patch };

  if (isRemoteConfigured && supabase) {
    const { error } = await supabase.from('huddles').update({ settings }).eq('id', huddleId);
    if (error) throw error;
    return settings;
  }
  const huddles = await readJson<Huddle[]>(STORAGE_KEYS.huddles, []);
  await writeJson(
    STORAGE_KEYS.huddles,
    huddles.map((h) => (h.id === huddleId ? { ...h, settings } : h))
  );
  return settings;
}

export type WeekNotes = { notes: JournalNote[]; photos: JournalPhoto[] };

/** The caller's own notes plus any shared notes from the huddle. */
export async function getNotesForWeek(huddleId: string, week: number): Promise<WeekNotes> {
  if (isRemoteConfigured && supabase) {
    const { data: notes, error } = await supabase
      .from('journal_notes')
      .select('*')
      .eq('huddle_id', huddleId)
      .eq('week', week);
    if (error) throw error;
    const ids = (notes ?? []).map((n) => n.id);
    if (!ids.length) return { notes: [], photos: [] };
    const { data: photos, error: pErr } = await supabase
      .from('journal_photos')
      .select('*')
      .in('note_id', ids)
      .order('created_at');
    if (pErr) throw pErr;
    return { notes: notes ?? [], photos: photos ?? [] };
  }

  const me = await getCurrentUserId();
  const notes = (await readJson<JournalNote[]>(STORAGE_KEYS.journalNotes, [])).filter(
    (n) =>
      n.huddle_id === huddleId && n.week === week && (n.user_id === me || n.visibility === 'shared')
  );
  const ids = new Set(notes.map((n) => n.id));
  const photos = (await readJson<JournalPhoto[]>(STORAGE_KEYS.journalPhotos, [])).filter((p) =>
    ids.has(p.note_id)
  );
  return { notes, photos };
}

/** Creates or updates the caller's note for an item; visibility follows the huddle setting. */
export async function saveNote(params: {
  huddleId: string;
  userId: string;
  week: number;
  itemId: string;
  body: string;
}): Promise<JournalNote> {
  if (isRemoteConfigured && supabase) {
    const { data, error } = await supabase
      .from('journal_notes')
      .upsert(
        {
          huddle_id: params.huddleId,
          user_id: params.userId,
          week: params.week,
          item_id: params.itemId,
          body: params.body,
        },
        { onConflict: 'huddle_id,user_id,week,item_id' }
      )
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  const huddle = await getHuddle(params.huddleId);
  const notes = await readJson<JournalNote[]>(STORAGE_KEYS.journalNotes, []);
  const now = new Date().toISOString();
  const existing = notes.find(
    (n) =>
      n.huddle_id === params.huddleId &&
      n.user_id === params.userId &&
      n.week === params.week &&
      n.item_id === params.itemId
  );
  const note: JournalNote = {
    id: existing?.id ?? randomId(),
    huddle_id: params.huddleId,
    user_id: params.userId,
    week: params.week,
    item_id: params.itemId,
    body: params.body,
    visibility: huddle?.settings.notesVisibility ?? 'private',
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
  await writeJson(STORAGE_KEYS.journalNotes, [...notes.filter((n) => n.id !== note.id), note]);
  return note;
}

export async function deleteNote(noteId: string, photos: JournalPhoto[]) {
  if (isRemoteConfigured && supabase) {
    const paths = photos.filter((p) => p.note_id === noteId).map((p) => p.path);
    if (paths.length) {
      const { error: sErr } = await supabase.storage.from(JOURNAL_BUCKET).remove(paths);
      if (sErr) throw sErr;
    }
    const { error } = await supabase.from('journal_notes').delete().eq('id', noteId);
    if (error) throw error;
    return;
  }
  const notes = await readJson<JournalNote[]>(STORAGE_KEYS.journalNotes, []);
  const all = await readJson<JournalPhoto[]>(STORAGE_KEYS.journalPhotos, []);
  await writeJson(STORAGE_KEYS.journalNotes, notes.filter((n) => n.id !== noteId));
  await writeJson(STORAGE_KEYS.journalPhotos, all.filter((p) => p.note_id !== noteId));
}

/** Shrinks to at most PHOTO_MAX_WIDTH wide and re-encodes as JPEG. */
async function prepareJournalImage(uri: string): Promise<{ base64: string; uri: string }> {
  const context = ImageManipulator.manipulate(uri);
  const original = await context.renderAsync();
  const image =
    original.width > PHOTO_MAX_WIDTH
      ? await context
          .resize({
            width: PHOTO_MAX_WIDTH,
            // Web can't infer the height from null, so keep the aspect ratio explicitly.
            height: Math.round((original.height * PHOTO_MAX_WIDTH) / original.width),
          })
          .renderAsync()
      : original;
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  if (!saved.base64) throw new Error('Could not read the photo.');
  return { base64: saved.base64, uri: saved.uri };
}

function base64ToBytes(base64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = lookup[clean.charCodeAt(i)];
    const b = lookup[clean.charCodeAt(i + 1)];
    const c = lookup[clean.charCodeAt(i + 2)];
    const d = lookup[clean.charCodeAt(i + 3)];
    bytes[p++] = (a << 2) | (b >> 4);
    if (i + 2 < clean.length) bytes[p++] = ((b & 15) << 4) | (c >> 2);
    if (i + 3 < clean.length) bytes[p++] = ((c & 3) << 6) | d;
  }
  return bytes.subarray(0, p);
}

export async function addNotePhoto(note: JournalNote, uri: string): Promise<JournalPhoto> {
  const image = await prepareJournalImage(uri);

  if (isRemoteConfigured && supabase) {
    const path = `${note.huddle_id}/${note.user_id}/${note.id}/${randomId()}.jpg`;
    const { error: upErr } = await supabase.storage
      .from(JOURNAL_BUCKET)
      .upload(path, base64ToBytes(image.base64), { contentType: 'image/jpeg' });
    if (upErr) throw upErr;
    const { data, error } = await supabase
      .from('journal_photos')
      .insert({ note_id: note.id, user_id: note.user_id, path })
      .select('*')
      .single();
    if (error) {
      await supabase.storage.from(JOURNAL_BUCKET).remove([path]);
      throw error;
    }
    return data;
  }

  const photo: JournalPhoto = {
    id: randomId(),
    note_id: note.id,
    user_id: note.user_id,
    path: `data:image/jpeg;base64,${image.base64}`,
    created_at: new Date().toISOString(),
  };
  const photos = await readJson<JournalPhoto[]>(STORAGE_KEYS.journalPhotos, []);
  await writeJson(STORAGE_KEYS.journalPhotos, [...photos, photo]);
  return photo;
}

export async function removeNotePhoto(photo: JournalPhoto) {
  if (isRemoteConfigured && supabase) {
    const { error: sErr } = await supabase.storage.from(JOURNAL_BUCKET).remove([photo.path]);
    if (sErr) throw sErr;
    const { error } = await supabase.from('journal_photos').delete().eq('id', photo.id);
    if (error) throw error;
    return;
  }
  const photos = await readJson<JournalPhoto[]>(STORAGE_KEYS.journalPhotos, []);
  await writeJson(STORAGE_KEYS.journalPhotos, photos.filter((p) => p.id !== photo.id));
}

/** Short-lived viewing URLs keyed by photo path. */
export async function notePhotoUrls(photos: JournalPhoto[]): Promise<Record<string, string>> {
  if (!photos.length) return {};
  if (isRemoteConfigured && supabase) {
    const { data, error } = await supabase.storage
      .from(JOURNAL_BUCKET)
      .createSignedUrls(
        photos.map((p) => p.path),
        60 * 60
      );
    if (error) throw error;
    const urls: Record<string, string> = {};
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) urls[item.path] = item.signedUrl;
    }
    return urls;
  }
  return Object.fromEntries(photos.map((p) => [p.path, p.path]));
}

async function removeStorageFiles(paths: string[]) {
  if (!supabase) return;
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await supabase.storage.from(JOURNAL_BUCKET).remove(paths.slice(i, i + 100));
    if (error) throw error;
  }
}

async function removeOwnPhotoFiles(userId: string) {
  if (!supabase) return;
  const { data, error } = await supabase.from('journal_photos').select('path').eq('user_id', userId);
  if (error) return; // journaling not set up on this project yet
  await removeStorageFiles((data ?? []).map((r) => r.path as string));
}

async function removeHuddlePhotoFiles(huddleId: string) {
  if (!supabase) return;
  const { data, error } = await supabase.rpc('journal_photo_paths_for_huddle', { hid: huddleId });
  if (error) return; // journaling not set up on this project yet
  await removeStorageFiles((data ?? []) as string[]);
}
