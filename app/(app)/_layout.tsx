import { Tabs, useRouter } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { Pressable, type ColorValue } from 'react-native';
import { useAuth } from '@/lib/AuthContext';
import { hasStudyContent } from '@/lib/content';
import { useContent } from '@/lib/ContentContext';
import { useTheme } from '@/lib/ThemeContext';

type AndroidSymbol = NonNullable<
  Extract<ComponentProps<typeof SymbolView>['name'], object>['android']
>;

function BackButton({ color }: { color: ColorValue }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={12}
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/(app)'))}
      style={{ paddingHorizontal: 12 }}
    >
      <SymbolView
        name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
        tintColor={color}
        size={22}
      />
    </Pressable>
  );
}

function tabIcon(ios: SFSymbol, iosFocused: SFSymbol, material: AndroidSymbol) {
  return ({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) => (
    <SymbolView
      name={{ ios: focused ? iosFocused : ios, android: material, web: material }}
      tintColor={color}
      size={size}
    />
  );
}

export default function AppLayout() {
  const { colors } = useTheme();
  const { huddle } = useAuth();
  const { pathway } = useContent();
  const currentWeek =
    huddle && pathway ? (pathway.weeks.find((w) => w.weekNumber === huddle.current_week) ?? null) : null;
  const showStudy = hasStudyContent(currentWeek, pathway?.resources);
  const hidden = { href: null, headerLeft: () => <BackButton color={colors.ink} /> } as const;

  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.ink,
        headerTitleStyle: { fontWeight: '700', color: colors.ink },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.muted,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedText,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'This Week',
          tabBarIcon: tabIcon('calendar', 'calendar', 'calendar_today'),
        }}
      />
      <Tabs.Screen
        name="study"
        options={{
          title: 'Study',
          href: showStudy ? undefined : null,
          tabBarIcon: tabIcon('book', 'book.fill', 'menu_book'),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          tabBarIcon: tabIcon('checkmark.circle', 'checkmark.circle.fill', 'task_alt'),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarIcon: tabIcon('gearshape', 'gearshape.fill', 'settings') }}
      />
      <Tabs.Screen name="guide" options={{ title: 'Guide', ...hidden }} />
      <Tabs.Screen name="leader-guide" options={{ title: 'Leader Guide', ...hidden }} />
      <Tabs.Screen name="leader-materials" options={{ title: 'Leader Materials', ...hidden }} />
      <Tabs.Screen name="challenge-pool" options={{ title: 'Challenge Pool', ...hidden }} />
      <Tabs.Screen name="meetings" options={{ title: 'Meetings', ...hidden }} />
    </Tabs>
  );
}
