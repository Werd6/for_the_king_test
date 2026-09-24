import { useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Body, Field, PrimaryButton, Screen, Title } from '@/components/ui';
import { joinHuddleByCode } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';

export default function JoinHuddleScreen() {
  const { userId, refresh } = useAuth();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!userId) return;
    setBusy(true);
    try {
      const huddle = await joinHuddleByCode(userId, code);
      await refresh();
      Alert.alert('Joined', `You are in ${huddle.name}`);
      router.replace('/');
    } catch (e) {
      Alert.alert('Could not join', e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>Join Huddle</Title>
      <Body>Enter the 6-character invite code from your huddle leader.</Body>
      <Field
        label="Invite code"
        value={code}
        onChangeText={(t) => setCode(t.toUpperCase())}
        autoCapitalize="characters"
        placeholder="ABC123"
      />
      <PrimaryButton title={busy ? 'Joining…' : 'Join'} onPress={submit} disabled={busy} />
    </Screen>
  );
}
