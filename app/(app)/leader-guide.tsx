import { ScrollView } from 'react-native';
import { Redirect } from 'expo-router';
import { Body, BulletList, Loading, Screen, Section, Title } from '@/components/ui';
import { useAuth } from '@/lib/AuthContext';
import { useContent } from '@/lib/ContentContext';

export default function LeaderGuideScreen() {
  const { isLeader } = useAuth();
  const { pathway, loading } = useContent();
  if (!isLeader) return <Redirect href="/(app)/settings" />;
  if (loading || !pathway) return <Loading />;

  const leaderGuide = pathway.leaderGuide;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 48 }}>
        <Title>Leader Guide</Title>
        <Body>{leaderGuide.intro}</Body>

        {leaderGuide.movements.map((m) => (
          <Section key={m.name} title={`Movement: ${m.name}`}>
            <Body>Watch for: {m.watchFor}</Body>
            <Body>Do not force: {m.doNotForce}</Body>
          </Section>
        ))}

        <Section title="A Simple Leader Check-In">
          <BulletList items={leaderGuide.checkIn} />
        </Section>

        <Section title="Final Vision">
          <Body>{leaderGuide.finalVision.intro}</Body>
          <BulletList items={leaderGuide.finalVision.points} />
          <Body>{leaderGuide.finalVision.closing}</Body>
        </Section>
      </ScrollView>
    </Screen>
  );
}
