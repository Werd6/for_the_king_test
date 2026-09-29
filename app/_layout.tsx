import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import { AuthProvider } from '@/lib/AuthContext';
import { ContentProvider } from '@/lib/ContentContext';
import { ThemeProvider, useTheme } from '@/lib/ThemeContext';

SplashScreen.preventAutoHideAsync();

// Supabase falls back to the Site URL when the requested redirect isn't allow-listed, so a
// recovery link can land on "/". Rewrite before the router reads the URL.
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const { pathname, search, hash } = window.location;
  if (pathname !== '/reset-password' && /(^|[#&?])type=recovery(&|$)/.test(`${search}${hash}`)) {
    window.history.replaceState(null, '', `/reset-password${search}${hash}`);
  }
}

export { ErrorBoundary } from 'expo-router';

function ThemedStack() {
  const { colors, scheme } = useTheme();
  const navigationTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.bg,
        card: colors.bg,
        text: colors.ink,
        border: colors.border,
        notification: colors.accent,
      },
    };
  }, [scheme, colors]);

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerBackTitle: 'Back',
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.ink,
          headerTitleStyle: { fontWeight: '700', color: colors.ink },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/sign-in" options={{ title: 'Sign In' }} />
        <Stack.Screen name="(auth)/reset-password" options={{ title: 'Reset Password' }} />
        <Stack.Screen name="(onboarding)/join-create" options={{ title: 'Your Huddle' }} />
        <Stack.Screen name="(onboarding)/create" options={{ title: 'Create Huddle' }} />
        <Stack.Screen name="(onboarding)/join" options={{ title: 'Join Huddle' }} />
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack>
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <ContentProvider>
          <ThemedStack />
        </ContentProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
