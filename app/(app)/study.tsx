import { ScrollView, Text } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Body,
  BulletList,
  Card,
  FeedbackLink,
  Loading,
  Screen,
  Section,
  SettingsGroup,
  SettingsRow,
  Subtitle,
  Title,
} from '@/components/ui';
import { QuoteBlock, StudyBlocks } from '@/components/StudyBlocks';
import { useAuth } from '@/lib/AuthContext';
import { isStandardWeek } from '@/lib/content';
import { useContent } from '@/lib/ContentContext';
import { useTheme } from '@/lib/ThemeContext';

/** The week's shared reading (definition, quotes, article) plus the pathway's guide pages. */
export default function StudyScreen() {
  const { huddle } = useAuth();
  const { getWeek, pathway, loading } = useContent();
  const { colors } = useTheme();
  const router = useRouter();

  if (!huddle || loading || !pathway) return <Loading />;

  const week = getWeek(huddle.current_week);
  const study = isStandardWeek(week) ? week.study : undefined;
  const soap = isStandardWeek(week) ? (week.soap ?? []) : [];
  const resources = pathway.resources ?? [];

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 48 }}>
        <Title>
          Week {week.weekNumber}: {week.title}
        </Title>
        {week.movement ? (
          <Text style={{ fontWeight: '600', color: colors.mutedText }}>{week.movement}</Text>
        ) : null}

        {study?.preface ? (
          <Card title={study.preface.title}>
            <StudyBlocks blocks={study.preface.blocks} />
          </Card>
        ) : null}

        {study?.definition ? (
          <Card title={week.title}>
            <Body>{study.definition}</Body>
          </Card>
        ) : null}

        {study?.quotes?.length ? (
          <Section title="Quotes">
            {study.quotes.map((q, i) => (
              <QuoteBlock key={i} text={q.text} source={q.source} />
            ))}
          </Section>
        ) : null}

        {study?.article?.length ? (
          <Section title="Article">
            <StudyBlocks blocks={study.article} />
          </Section>
        ) : null}

        {soap.length ? (
          <Card title="SOAP passages">
            <BulletList items={soap.map((s) => s.text)} />
            <Body>Check them off on This Week as you study each one.</Body>
          </Card>
        ) : null}

        {!study ? (
          <Subtitle>There’s no shared reading for this week.</Subtitle>
        ) : null}

        {resources.length ? (
          <SettingsGroup label="Guide">
            {resources.map((r) => (
              <SettingsRow
                key={r.id}
                label={r.title}
                onPress={() => router.push({ pathname: '/(app)/guide', params: { id: r.id } })}
              />
            ))}
          </SettingsGroup>
        ) : null}
        <FeedbackLink />
      </ScrollView>
    </Screen>
  );
}
