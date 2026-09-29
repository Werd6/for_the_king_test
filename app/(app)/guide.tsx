import { ScrollView } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Body, Loading, Screen, Title } from '@/components/ui';
import { StudyBlocks } from '@/components/StudyBlocks';
import { useContent } from '@/lib/ContentContext';

/** One pathway guide page (How to SOAP, Huddle Rhythms, …). */
export default function GuideScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { pathway, loading } = useContent();

  if (loading || !pathway) return <Loading />;

  const resource = pathway.resources?.find((r) => r.id === id);

  return (
    <Screen>
      <Stack.Screen options={{ title: resource?.title ?? 'Guide' }} />
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 48 }}>
        {resource ? (
          <>
            <Title>{resource.title}</Title>
            <StudyBlocks blocks={resource.blocks} />
          </>
        ) : (
          <Body>This page isn’t available for your pathway.</Body>
        )}
      </ScrollView>
    </Screen>
  );
}
