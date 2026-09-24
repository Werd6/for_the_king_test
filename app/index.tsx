import { Redirect } from 'expo-router';
import { Loading } from '@/components/ui';
import { useAuth } from '@/lib/AuthContext';

export default function Index() {
  const { loading, userId, huddle } = useAuth();

  if (loading) return <Loading />;
  if (!userId) return <Redirect href="/(auth)/sign-in" />;
  if (!huddle) return <Redirect href="/(onboarding)/join-create" />;
  return <Redirect href="/(app)" />;
}
