import { ScrollView, Text } from 'react-native';
import { Redirect } from 'expo-router';
import { Body, FeedbackLink, Loading, Screen, Section, Title } from '@/components/ui';
import { useAuth } from '@/lib/AuthContext';
import { useContent } from '@/lib/ContentContext';
import { useTheme } from '@/lib/ThemeContext';

export default function ChallengePoolScreen() {
  const { isLeader } = useAuth();
  const { pathway, loading } = useContent();
  const { fonts, colors } = useTheme();
  if (!isLeader) return <Redirect href="/(app)/(tabs)/settings" />;
  if (loading || !pathway) return <Loading />;

  const challengePool = pathway.challengePool;
  if (!challengePool) return <Redirect href="/(app)/(tabs)/progress" />;
  const categories = challengePool.categories as Record<string, { id: string; text: string }[]>;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 48 }}>
        <Title>Optional Challenge Pool</Title>
        <Body>{challengePool.intro}</Body>

        {Object.entries(categories).map(([name, items]) => (
          <Section key={name} title={name.charAt(0).toUpperCase() + name.slice(1)}>
            {items.map((item) => (
              <Text
                key={item.id}
                style={{ ...fonts.regular, marginBottom: 6, fontSize: 15, color: colors.ink }}
              >
                • {item.text}
              </Text>
            ))}
          </Section>
        ))}

        <Section title="Physical Challenge Guardrails">
          <Body>{challengePool.guardrails}</Body>
        </Section>
        <FeedbackLink />
      </ScrollView>
    </Screen>
  );
}
