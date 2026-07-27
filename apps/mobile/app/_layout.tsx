import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { lightTheme, darkTheme } from '@/theme/theme';
import { queryClient } from '@/state/queryClient';
import { useAuthStore } from '@/state/authStore';

export default function RootLayout() {
  const scheme = useColorScheme();
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <QueryClientProvider client={queryClient}>
      <PaperProvider theme={scheme === 'dark' ? darkTheme : lightTheme}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
        </Stack>
      </PaperProvider>
    </QueryClientProvider>
  );
}
