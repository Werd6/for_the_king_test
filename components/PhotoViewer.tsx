import { typography } from '@/lib/theme';
import { useEffect, useRef, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** Full-screen photo viewer. Swipe between photos; pinch to zoom on iOS. */
export function PhotoViewer({
  uris,
  index,
  onClose,
}: {
  uris: string[];
  /** Photo to open at; null hides the viewer. */
  index: number | null;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const pager = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  // Keeps photos on screen while the modal animates closed.
  const [shownUris, setShownUris] = useState<string[]>([]);

  useEffect(() => {
    if (index == null) return;
    setShownUris(uris);
    setPage(index);
    // Wait a frame so the pager has laid out before jumping to the tapped photo.
    requestAnimationFrame(() => pager.current?.scrollTo({ x: index * width, animated: false }));
    // Only re-sync when opened or rotated; parents pass a fresh uris array each render.
  }, [index, width]);

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  }

  return (
    <Modal
      visible={index != null}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <ScrollView
          ref={pager}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          onScrollEndDrag={onScrollEnd}
          contentOffset={{ x: (index ?? 0) * width, y: 0 }}
        >
          {shownUris.map((uri) => (
            <ScrollView
              key={uri}
              style={{ width, height }}
              contentContainerStyle={{ width, height, alignItems: 'center', justifyContent: 'center' }}
              maximumZoomScale={4}
              minimumZoomScale={1}
              centerContent
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
            >
              <Image
                source={{ uri }}
                style={{ width, height }}
                resizeMode="contain"
                accessibilityLabel="Journal photo"
              />
            </ScrollView>
          ))}
        </ScrollView>
        <SafeAreaView
          edges={['top']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
          pointerEvents="box-none"
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 12,
            }}
            pointerEvents="box-none"
          >
            <Text style={{ ...typography.label, color: '#fff', flex: 1 }}>
              {shownUris.length > 1 ? `${page + 1} of ${shownUris.length}` : ''}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              hitSlop={12}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 16,
                backgroundColor: 'rgba(0,0,0,0.6)',
              }}
            >
              <Text style={{ ...typography.button, color: '#fff' }}>Done</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
