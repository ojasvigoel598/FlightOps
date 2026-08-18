import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AlertProvider } from '@/template';
import { GameProvider } from '@/contexts/GameContext';
import { colors } from '@/constants/theme';
import { registerServiceWorker, setupWebHead } from '@/services/pwa';

export default function RootLayout() {
  useEffect(() => {
    setupWebHead();
    registerServiceWorker();
  }, []);

  return (
    <AlertProvider>
      <SafeAreaProvider>
        <GameProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="mission" options={{ gestureEnabled: false }} />
            <Stack.Screen name="result" options={{ gestureEnabled: false }} />
          </Stack>
        </GameProvider>
      </SafeAreaProvider>
    </AlertProvider>
  );
}
