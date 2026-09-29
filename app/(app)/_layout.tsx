import { Tabs } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { useTheme } from '@/lib/ThemeContext';

type AndroidSymbol = NonNullable<
  Extract<ComponentProps<typeof SymbolView>['name'], object>['android']
>;

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

  return (
    <Tabs
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
        options={{ title: 'This Week', tabBarIcon: tabIcon('book', 'book.fill', 'menu_book') }}
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
      <Tabs.Screen name="leader-guide" options={{ title: 'Leader Guide', href: null }} />
      <Tabs.Screen name="leader-materials" options={{ title: 'Leader Materials', href: null }} />
      <Tabs.Screen name="challenge-pool" options={{ title: 'Challenge Pool', href: null }} />
      <Tabs.Screen name="meetings" options={{ title: 'Meetings', href: null }} />
    </Tabs>
  );
}
