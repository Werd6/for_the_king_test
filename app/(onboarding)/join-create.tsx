import { Redirect, useRouter } from 'expo-router';
import { Body, PrimaryButton, Screen, Title } from '@/components/ui';
import { useAuth } from '@/lib/AuthContext';

export default function JoinCreateScreen() {
  const router = useRouter();
  const { profile, signOut, userId, huddle } = useAuth();

  if (!userId) return <Redirect href="/(auth)/sign-in" />;
  if (huddle) return <Redirect href="/(app)" />;

  return (
    <Screen>
      <Title>Welcome{profile?.display_name ? `, ${profile.display_name}` : ''}</Title>
      <Body>You are not in a huddle yet. Join with an invite code or create one as the leader.</Body>
      <PrimaryButton title="Join Huddle" onPress={() => router.push('/(onboarding)/join')} />
      <PrimaryButton title="Create Huddle" onPress={() => router.push('/(onboarding)/create')} />
      <PrimaryButton title="Sign out" onPress={() => signOut()} />
    </Screen>
  );
}
