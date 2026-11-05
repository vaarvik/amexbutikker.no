import { Stack } from 'expo-router';
import { ShareIntentProvider } from 'expo-share-intent';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { CompositionRoot } from '../composition-root';
import { ServicesProvider } from '../ui/services';
import { ShareIntentRouter } from '../ui/share-intent-router';
import { usePalette } from '../ui/theme';

export default function RootLayout() {
  // Built once per app start; screens reach it through useServices().
  const [services] = useState(() => CompositionRoot.fromEnv());
  const palette = usePalette();
  // The share-intent provider must sit above every other provider (expo-share-intent docs).
  // It is disabled on the web, where nothing can be shared into the app.
  return (
    <ShareIntentProvider>
      <ServicesProvider services={services}>
        {services.native ? <ShareIntentRouter /> : null}
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
          <Stack.Screen name="shared" options={{ title: 'Delt sted' }} />
        </Stack>
      </ServicesProvider>
    </ShareIntentProvider>
  );
}
