import { ScrollView, Text } from 'react-native';
import { Redirect } from 'expo-router';
import { Body, Loading, Screen, Section, Title } from '@/components/ui';
import { useAuth } from '@/lib/AuthContext';
import { useContent } from '@/lib/ContentContext';

export default function ChallengePoolScreen() {
  const { isLeader } = useAuth();
  const { pathway, loading } = useContent();
  if (!isLeader) return <Redirect href="/(app)/settings" />;
  if (loading || !pathway) return <Loading />;

  const challengePool = pathway.challengePool;
  const categories = challengePool.categories as Record<string, { id: string; text: string }[]>;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 48 }}>
        <Title>Optional Challenge Pool</Title>
        <Body>{challengePool.intro}</Body>
        <Body>
          Read-only in v1. Substitute verbally if needed — the app does not swap weekly items yet.
        </Body>

        {Object.entries(categories).map(([name, items]) => (
          <Section key={name} title={name}>
            {items.map((item) => (
              <Text key={item.id} style={{ marginBottom: 6, fontSize: 15 }}>
                • {item.text}
              </Text>
            ))}
          </Section>
        ))}

        <Section title="Physical Challenge Guardrails">
          <Body>{challengePool.guardrails}</Body>
        </Section>
      </ScrollView>
    </Screen>
  );
}
