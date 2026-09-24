import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AuthProvider } from '@/lib/AuthContext';
import { ContentProvider } from '@/lib/ContentContext';
import { ThemeProvider, useTheme } from '@/lib/ThemeContext';

SplashScreen.preventAutoHideAsync();

export { ErrorBoundary } from 'expo-router';

function ThemedStack() {
  const { colors, scheme } = useTheme();

  return (
    <>
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
        <Stack.Screen name="(onboarding)/join-create" options={{ title: 'Your Huddle' }} />
        <Stack.Screen name="(onboarding)/create" options={{ title: 'Create Huddle' }} />
        <Stack.Screen name="(onboarding)/join" options={{ title: 'Join Huddle' }} />
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack>
    </>
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
