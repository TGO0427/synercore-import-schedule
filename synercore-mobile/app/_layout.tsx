import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect } from 'react';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { initializeApp, cleanupApp } from '@/services/init';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    // Initialize all services on app startup
    initializeApp();

    // Cleanup on app shutdown
    return () => {
      cleanupApp();
    };
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false, animationEnabled: true }} />
        <Stack.Screen name="(app)" options={{ headerShown: false, animationEnabled: true }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
