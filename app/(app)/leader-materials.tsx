import { ScrollView, Text } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Body, BulletList, Card, Loading, PrimaryButton, Screen, Subtitle, Title } from '@/components/ui';
import { useAuth } from '@/lib/AuthContext';
import { useContent } from '@/lib/ContentContext';
import { isGroupChallengeWeek, isStandardWeek } from '@/lib/content';
import { useTheme } from '@/lib/ThemeContext';

/**
 * Meeting-facilitation content for the current week.
 * Intro, reading, discuss (standard) or group meeting prompts (group challenge weeks).
 */
export default function LeaderMaterialsScreen() {
  const { isLeader, huddle } = useAuth();
  const { getWeek, loading: contentLoading, pathway } = useContent();
  const { colors } = useTheme();
  const router = useRouter();

  if (!isLeader) return <Redirect href="/(app)/settings" />;
  if (!huddle || contentLoading || !pathway) return <Loading />;

  const week = getWeek(huddle.current_week);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 48 }}>
        <Title>Leader Materials</Title>
        <Subtitle>
          Week {week.weekNumber}: {week.title}
        </Subtitle>
        <Text style={{ fontWeight: '600', color: colors.ink }}>{week.movement}</Text>
        <Body>For the in-person huddle meeting — not shown on members’ personal week screens.</Body>
        {pathway.leaderGuide ? (
          <PrimaryButton title="Open Leader Guide" onPress={() => router.push('/(app)/leader-guide')} />
        ) : null}

        {isStandardWeek(week) ? (
          <>
            <Card title="Description">
              <Body>{week.intro}</Body>
            </Card>

            <Card title={week.soap?.length ? 'SOAP passages' : 'Reading'}>
              <Body>{week.reading}</Body>
            </Card>

            <Card title="Discuss">
              <BulletList items={week.discuss} />
            </Card>

            {week.challengeReview?.length ? (
              <Card title="Challenge review">
                <Body>When you gather again, share which option each person chose and how it went.</Body>
                <BulletList items={week.challengeReview} />
              </Card>
            ) : null}
          </>
        ) : null}

        {isGroupChallengeWeek(week) ? (
          <>
            <Card title="Description">
              <Body>{week.intro}</Body>
            </Card>

            <Card title="Activity options">
              <BulletList items={week.options.map((o) => o.text)} />
              <Body>Pick the official activity on This Week so everyone sees the same choice.</Body>
            </Card>

            <Card title="Before You Go">
              <BulletList items={week.beforeYouGo} />
            </Card>

            <Card title="Close in Prayer">
              <Body>{week.closeInPrayer}</Body>
            </Card>

            {week.celebrate || week.weekNumber === 20 ? (
              <Card title="Celebrate">
                <Body>{week.celebrate || 'Celebration content coming soon.'}</Body>
              </Card>
            ) : null}

            <Card title="Guardrails">
              <Body>{week.guardrails}</Body>
            </Card>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
