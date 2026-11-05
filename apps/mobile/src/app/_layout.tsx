import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { CompositionRoot } from '../composition-root';
import { ServicesProvider } from '../ui/services';
import { usePalette } from '../ui/theme';

export default function RootLayout() {
  // Built once per app start; screens reach it through useServices().
  const [services] = useState(() => CompositionRoot.fromEnv());
  const palette = usePalette();
  return (
    <ServicesProvider services={services}>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: palette.background },
          headerTintColor: palette.accent,
          headerTitleStyle: { color: palette.text },
          contentStyle: { backgroundColor: palette.background },
          headerBackTitle: 'Tilbake',
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Tar de Amex?' }} />
        <Stack.Screen name="place/[id]" options={{ title: '' }} />
        <Stack.Screen name="add" options={{ title: 'Legg til sted', presentation: 'modal' }} />
      </Stack>
    </ServicesProvider>
  );
}
