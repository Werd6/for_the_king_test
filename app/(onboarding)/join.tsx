import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Body, FeedbackLink, Field, PrimaryButton, Screen, Title } from '@/components/ui';
import { joinHuddleByCode } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { showAlert } from '@/lib/dialogs';
import { friendlyError } from '@/lib/errors';

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
      showAlert('Joined', `You are in ${huddle.name}`);
      // Drop the onboarding screens so Back can't return to them from the huddle.
      if (router.canDismiss()) router.dismissAll();
      router.replace('/');
    } catch (e) {
      showAlert('Could not join', friendlyError(e, 'Error'));
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
      <FeedbackLink />
    </Screen>
  );
}
