import { useEffect, useState } from 'react';
import { Linking, Platform, ScrollView, Text } from 'react-native';
import {
  Body,
  Field,
  Loading,
  PrimaryButton,
  Screen,
  SettingsGroup,
  SettingsInset,
  SettingsRow,
  Title,
} from '@/components/ui';
import { DateTimeField, defaultMeetingTime } from '@/components/DateTimeField';
import { updateMeetingInfo } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { syncHuddleMeetingsToDevice } from '@/lib/calendar';
import { showAlert } from '@/lib/dialogs';
import { useTheme } from '@/lib/ThemeContext';

function formatMeetingTime(iso: string | null): string {
  if (!iso) return 'Not set';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function looksLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim()) || /^www\./i.test(value.trim());
}

export default function MeetingsScreen() {
  const { huddle, userId, isLeader, refresh } = useAuth();
  const { colors } = useTheme();
  const [time, setTime] = useState<Date | null>(null);
  const [location, setLocation] = useState('');
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!huddle) return;
    setTime(huddle.meetings.time ? new Date(huddle.meetings.time) : null);
    setLocation(huddle.meetings.location ?? '');
  }, [huddle]);

  if (!huddle || !userId) return <Loading />;

  const dirty =
    (time?.toISOString() ?? null) !== (huddle.meetings.time ?? null) ||
    (location.trim() || null) !== (huddle.meetings.location ?? null);

  function startPicking() {
    if (!time) setTime(defaultMeetingTime());
    setPicking(true);
  }

  async function save() {
    if (!isLeader || !huddle || !userId) return;
    setBusy(true);
    try {
      await updateMeetingInfo(huddle.id, userId, {
        time: time ? time.toISOString() : null,
        location: location.trim() || null,
      });
      await refresh();
      setPicking(false);
      showAlert('Saved', 'Meeting details updated.');
    } catch (e) {
      showAlert('Error', e instanceof Error ? e.message : 'Could not update');
    } finally {
      setBusy(false);
    }
  }

  async function openLocation() {
    if (!huddle) return;
    const raw = (huddle.meetings.location ?? '').trim();
    if (!raw) return;
    const url = looksLikeUrl(raw)
      ? raw.startsWith('http')
        ? raw
        : `https://${raw}`
      : Platform.select({
          ios: `http://maps.apple.com/?q=${encodeURIComponent(raw)}`,
          android: `geo:0,0?q=${encodeURIComponent(raw)}`,
          default: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(raw)}`,
        });
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch {
      showAlert('Could not open', raw);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 4, paddingBottom: 48 }}>
        <Title>Meeting</Title>
        <Body>One weekly time and a place or link for the huddle.</Body>
        {!isLeader ? <Body>Only the leader can edit these details.</Body> : null}

        <SettingsGroup label="When">
          <SettingsRow
            label="Meeting time"
            value={formatMeetingTime(time ? time.toISOString() : null)}
            onPress={
              isLeader
                ? () => (picking ? setPicking(false) : startPicking())
                : undefined
            }
            showChevron={isLeader}
          />
          {isLeader && picking ? (
            <SettingsInset>
              <Body>Choose date and time:</Body>
              <DateTimeField
                value={time ?? defaultMeetingTime()}
                onChange={(next) => setTime(next)}
              />
              <SettingsRow
                label="Clear time"
                onPress={() => {
                  setTime(null);
                  setPicking(false);
                }}
                showChevron={false}
                destructive
              />
            </SettingsInset>
          ) : null}
        </SettingsGroup>

        <SettingsGroup label="Where" footer="Paste a Zoom/Meet link or a street address.">
          {isLeader ? (
            <SettingsInset>
              <Field
                label="Location or link"
                value={location}
                onChangeText={setLocation}
                placeholder="https://… or 123 Main St"
                autoCapitalize="none"
              />
            </SettingsInset>
          ) : huddle.meetings.location ? (
            <SettingsRow label={huddle.meetings.location} onPress={openLocation} />
          ) : (
            <SettingsRow label="No location set" showChevron={false} />
          )}
        </SettingsGroup>

        {isLeader && dirty ? (
          <PrimaryButton title={busy ? 'Saving…' : 'Save'} onPress={save} disabled={busy} />
        ) : null}

        {!isLeader && huddle.meetings.location ? (
          <PrimaryButton title="Open location / link" onPress={openLocation} />
        ) : null}

        <SettingsGroup label="Device">
          <SettingsRow
            label="Add to device calendar"
            onPress={async () => {
              try {
                const n = await syncHuddleMeetingsToDevice(huddle);
                showAlert(
                  'Calendar',
                  n ? 'Meeting added to your calendar.' : 'Set a meeting time first.'
                );
              } catch (e) {
                showAlert('Error', e instanceof Error ? e.message : 'Failed');
              }
            }}
          />
        </SettingsGroup>

        {time ? (
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 8, marginHorizontal: 4 }}>
            Tip: pick the next meeting’s date & time — brothers can add it to their calendars from
            here.
          </Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
