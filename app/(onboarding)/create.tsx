import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
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
import { friendlyError } from '@/lib/errors';
import { useContent } from '@/lib/ContentContext';
import { showAlert } from '@/lib/dialogs';
import type { PathwayOption } from '@/lib/content';
import { typography } from '@/lib/theme';
import { useTheme } from '@/lib/ThemeContext';

export default function CreateHuddleScreen() {
  const { colors, radii } = useTheme();
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
      showAlert('Could not create', friendlyError(e, 'Error'));
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
            <Body>No pathways are available right now. Please try again later.</Body>
          ) : (
            options.map((p) => {
              const isSelected = selected?.pathwayVersionId === p.pathwayVersionId;
              return (
                <Pressable
                  key={p.pathwayVersionId}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={`${p.name}, ${p.totalWeeks} weeks`}
                  onPress={() => setSelected(p)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    gap: 12,
                    padding: 14,
                    marginBottom: 8,
                    borderRadius: radii.md,
                    borderWidth: isSelected ? 2 : 1,
                    borderColor: isSelected ? colors.primary : colors.border,
                    backgroundColor: isSelected ? colors.surfaceStrong : colors.surface,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      marginTop: 1,
                      borderRadius: 11,
                      borderWidth: 2,
                      borderColor: isSelected ? colors.primary : colors.muted,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isSelected ? (
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} />
                    ) : null}
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ ...typography.subtitle, color: colors.ink }}>
                      {p.name} · {p.totalWeeks} weeks
                    </Text>
                    <Text style={{ ...typography.body, color: colors.mutedText }}>{p.description}</Text>
                  </View>
                </Pressable>
              );
            })
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
