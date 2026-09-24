import {
  CalendarAccessLevel,
  EntityTypes,
  createCalendar,
  getCalendars,
  getDefaultCalendarSync,
  requestCalendarPermissions,
  type ExpoCalendar,
} from 'expo-calendar';
import { Platform } from 'react-native';
import { showAlert } from '@/lib/dialogs';
import type { Huddle } from '@/lib/types';

const CALENDAR_TITLE = 'For The King Huddle';
const EVENT_TITLE_PREFIX = 'Huddle —';

async function ensurePermissions(): Promise<boolean> {
  const { status } = await requestCalendarPermissions();
  if (status !== 'granted') {
    showAlert('Calendar permission needed', 'Allow calendar access to add huddle meetings.');
    return false;
  }
  return true;
}

async function getOrCreateCalendar(): Promise<ExpoCalendar | null> {
  const calendars = await getCalendars(EntityTypes.EVENT);
  const existing = calendars.find((c) => c.title === CALENDAR_TITLE);
  if (existing) return existing;

  if (Platform.OS === 'ios') {
    try {
      const defaultCalendar = getDefaultCalendarSync();
      return createCalendar({
        title: CALENDAR_TITLE,
        color: '#17B890',
        entityType: EntityTypes.EVENT,
        sourceId: defaultCalendar.source?.id,
        source: defaultCalendar.source,
        name: CALENDAR_TITLE,
        ownerAccount: 'personal',
        accessLevel: CalendarAccessLevel.OWNER,
      });
    } catch {
      // Fall through to minimal create
    }
  }

  return createCalendar({
    title: CALENDAR_TITLE,
    color: '#17B890',
    entityType: EntityTypes.EVENT,
    name: CALENDAR_TITLE,
    ownerAccount: 'personal',
    accessLevel: CalendarAccessLevel.OWNER,
  });
}

/** Add/refresh a single event from huddle meeting time + location (native only). */
export async function syncHuddleMeetingsToDevice(huddle: Huddle): Promise<number> {
  if (Platform.OS === 'web') {
    throw new Error('Calendar sync works in the iOS/Android app, not in the browser.');
  }

  if (!huddle.meetings.time) return 0;

  const ok = await ensurePermissions();
  if (!ok) return 0;

  const calendar = await getOrCreateCalendar();
  if (!calendar) return 0;

  const rangeStart = new Date();
  rangeStart.setFullYear(rangeStart.getFullYear() - 1);
  const rangeEnd = new Date();
  rangeEnd.setFullYear(rangeEnd.getFullYear() + 2);

  const existing = await calendar.listEvents(rangeStart, rangeEnd);
  for (const event of existing) {
    if (
      event.title?.startsWith(EVENT_TITLE_PREFIX) ||
      event.title?.startsWith('Huddle Week')
    ) {
      await event.delete();
    }
  }

  const startDate = new Date(huddle.meetings.time);
  const endDate = new Date(startDate.getTime() + 90 * 60 * 1000);
  await calendar.createEvent({
    title: `${EVENT_TITLE_PREFIX}${huddle.name}`,
    startDate,
    endDate,
    location: huddle.meetings.location ?? undefined,
    notes: `For The King — invite ${huddle.invite_code}${
      huddle.meetings.location ? `\n${huddle.meetings.location}` : ''
    }`,
  });
  return 1;
}
