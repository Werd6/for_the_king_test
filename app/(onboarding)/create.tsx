import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Body,
  CheckboxRow,
  Field,
  Loading,
  PrimaryButton,
  Screen,
  Section,
  Title,
} from '@/components/ui';
import { DateTimeField, defaultMeetingTime } from '@/components/DateTimeField';
import { createHuddle } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { useContent } from '@/lib/ContentContext';
import { showAlert } from '@/lib/dialogs';
import type { PathwayOption } from '@/lib/content';

export default function CreateHuddleScreen() {
  const { userId, profile, refresh } = useAuth();
  const { options, refreshOptions } = useContent();
  const router = useRouter();
  const [selected, setSelected] = useState<PathwayOption | null>(null);
  const [scheduleMeetings, setScheduleMeetings] = useState(false);
  const [meetingTime, setMeetingTime] = useState(defaultMeetingTime);
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);

  useEffect(() => {
    (async () => {
      setLoadingOptions(true);
      try {
        await refreshOptions();
      } finally {
        setLoadingOptions(false);
      }
    })();
  }, [refreshOptions]);

  useEffect(() => {
    if (options.length && !selected) {
      setSelected(options[0]);
    }
  }, [options, selected]);

  async function submit() {
    if (!userId || !profile || !selected) return;
    setBusy(true);
    try {
      const huddle = await createHuddle({
        leaderId: userId,
        displayName: profile.display_name,
        pathwayId: selected.pathwayId,
        pathwayVersionId: selected.pathwayVersionId,
        totalWeeks: selected.totalWeeks,
        meetingTimeIso: scheduleMeetings ? meetingTime.toISOString() : null,
        meetingLocation: scheduleMeetings ? location.trim() || null : null,
      });
      await refresh();
      showAlert('Huddle created', `Invite code: ${huddle.invite_code}`);
      router.replace('/');
    } catch (e) {
      showAlert('Could not create', e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  if (loadingOptions) return <Loading />;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 40 }}>
        <Title>Configure Huddle</Title>
        <Body>Choose the pathway and optionally set a meeting time and place.</Body>

        <Section title="Pathway">
          {options.length === 0 ? (
            <Body>No published pathways found. Run npm run publish:pathway.</Body>
          ) : (
            options.map((p) => (
              <View key={p.pathwayVersionId} style={{ marginBottom: 8 }}>
                <PrimaryButton
                  title={`${selected?.pathwayVersionId === p.pathwayVersionId ? '✓ ' : ''}${p.name} (${p.totalWeeks} weeks)`}
                  onPress={() => setSelected(p)}
                />
                <Body>{p.description}</Body>
              </View>
            ))
          )}
        </Section>

        <Section title="Meeting (optional)">
          <CheckboxRow
            label="Set a weekly meeting time and location"
            checked={scheduleMeetings}
            onToggle={setScheduleMeetings}
          />
          {scheduleMeetings ? (
            <View style={{ gap: 10, marginTop: 8 }}>
              <Body>Pick the next meeting’s date & time.</Body>
              <DateTimeField value={meetingTime} onChange={setMeetingTime} />
              <Field
                label="Location or link"
                value={location}
                onChangeText={setLocation}
                placeholder="https://… or 123 Main St"
                autoCapitalize="none"
              />
            </View>
          ) : null}
          <Body>You can change this later in Settings → Meetings.</Body>
        </Section>

        <PrimaryButton
          title={busy ? 'Creating…' : 'Create huddle'}
          onPress={submit}
          disabled={busy || !selected}
        />
      </ScrollView>
    </Screen>
  );
}
