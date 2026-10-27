import { useNavigation, useSegments } from 'expo-router';
import TopTabs from 'expo-router/js-top-tabs';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useLayoutEffect, type ComponentProps } from 'react';
import { Platform, type ColorValue } from 'react-native';
import { SwipeTabBar, type SwipeTabBarProps } from '@/components/SwipeTabBar';
import { useAuth } from '@/lib/AuthContext';
import { hasStudyContent } from '@/lib/content';
import { useContent } from '@/lib/ContentContext';
import { TAB_TITLES, tabTitle } from '@/lib/tabs';
import { useTheme } from '@/lib/ThemeContext';

type AndroidSymbol = NonNullable<
  Extract<ComponentProps<typeof SymbolView>['name'], object>['android']
>;

function tabIcon(ios: SFSymbol, iosFocused: SFSymbol, material: AndroidSymbol) {
  return ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <SymbolView
      name={{ ios: focused ? iosFocused : ios, android: material, web: material }}
      tintColor={color}
      size={24}
    />
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  const { huddle } = useAuth();
  const { pathway } = useContent();
  const currentWeek =
    huddle && pathway ? (pathway.weeks.find((w) => w.weekNumber === huddle.current_week) ?? null) : null;
  const showStudy = hasStudyContent(currentWeek, pathway?.resources);

  const navigation = useNavigation();
  const title = tabTitle(useSegments().at(-1));
  useLayoutEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  return (
    <TopTabs
      tabBarPosition="bottom"
      tabBar={(props: SwipeTabBarProps) => <SwipeTabBar {...props} />}
      screenOptions={{
        swipeEnabled: Platform.OS !== 'web',
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedText,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <TopTabs.Screen
        name="index"
        options={{ title: TAB_TITLES.index, tabBarIcon: tabIcon('calendar', 'calendar', 'calendar_today') }}
      />
      <TopTabs.Protected guard={showStudy}>
        <TopTabs.Screen
          name="study"
          options={{ title: TAB_TITLES.study, tabBarIcon: tabIcon('book', 'book.fill', 'menu_book') }}
        />
      </TopTabs.Protected>
      <TopTabs.Screen
        name="progress"
        options={{
          title: TAB_TITLES.progress,
          tabBarIcon: tabIcon('checkmark.circle', 'checkmark.circle.fill', 'task_alt'),
        }}
      />
      <TopTabs.Screen
        name="settings"
        options={{ title: TAB_TITLES.settings, tabBarIcon: tabIcon('gearshape', 'gearshape.fill', 'settings') }}
      />
    </TopTabs>
  );
}
