import {
  generateInviteCode,
  isRemoteConfigured,
  randomId,
  readJson,
  STORAGE_KEYS,
  supabase,
  writeJson,
} from '@/lib/supabase';
import type { Huddle, MeetingInfo, Membership, Profile, ProgressRow, WeekPick } from '@/lib/types';

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

function normalizeHuddle(raw: Huddle | (Omit<Huddle, 'meetings'> & { meetings: unknown })): Huddle {
  return { ...raw, meetings: normalizeMeetings(raw.meetings) };
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
      options: { data: { display_name: displayName } },
    });
    if (error) throw error;

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
        'Account created. Check your email to confirm, then sign in. (Or disable Confirm email in Supabase → Authentication → Providers → Email.)'
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
    // Requires an Edge Function with service role in production.
    // For now: leave huddle / dissolve if leader, then sign out.
    const membership = await getMembershipForUser(userId);
    if (membership) {
      const huddle = await getHuddle(membership.huddle_id);
      if (huddle?.leader_id === userId) {
        await dissolveHuddle(huddle.id);
      } else {
        await leaveHuddle(userId);
      }
    }
    await supabase.auth.signOut();
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
    created_at: new Date().toISOString(),
  };

  if (isRemoteConfigured && supabase) {
    if (params.pathwayVersionId === 'local') {
      throw new Error('No published pathway in Supabase. Run npm run publish:pathway first.');
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
    const existing = await getMembershipForUser(userId);
    if (existing) throw new Error('You are already in a huddle.');
    const { data: huddle, error } = await supabase
      .from('huddles')
      .select('*')
      .eq('invite_code', normalized)
      .maybeSingle();
    if (error) throw error;
    if (!huddle) throw new Error('Invalid invite code.');
    const { error: memErr } = await supabase.from('memberships').insert({
      huddle_id: huddle.id,
      user_id: userId,
    });
    if (memErr) throw memErr;
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
