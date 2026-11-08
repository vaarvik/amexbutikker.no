import { Stack } from 'expo-router';
import { ShareIntentProvider } from 'expo-share-intent';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { CompositionRoot } from '../composition-root';
// Registers the background visit task; must load with the bundle.
import '../composition-root.tasks';
import { ServicesProvider } from '../ui/services';
import { ShareIntentRouter } from '../ui/share-intent-router';
import { VisitNotificationRouter } from '../ui/visit-notification-router';
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
        {services.native ? (
          <>
            <ShareIntentRouter />
            <VisitNotificationRouter />
          </>
        ) : null}
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
          <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Tar de Amex?' }} />
          <Stack.Screen name="place/[id]" options={{ title: '' }} />
          <Stack.Screen name="add" options={{ title: 'Legg til sted', presentation: 'modal' }} />
          <Stack.Screen name="shared" options={{ title: 'Delt sted' }} />
          <Stack.Screen
            name="spending/purchase"
            options={{ title: 'Legg til kjøp', presentation: 'modal' }}
          />
          <Stack.Screen
            name="spending/total"
            options={{ title: 'Oppdater total', presentation: 'modal' }}
          />
          <Stack.Screen
            name="spending/milestone"
            options={{ title: 'Nytt mål', presentation: 'modal' }}
          />
          <Stack.Screen
            name="spending/programmes"
            options={{ title: 'Velg kort', presentation: 'modal' }}
          />
          <Stack.Screen name="paid" options={{ title: 'Betaling', presentation: 'modal' }} />
          <Stack.Screen
            name="visit"
            options={{ title: 'Hvor betalte du?', presentation: 'modal' }}
          />
        </Stack>
      </ServicesProvider>
    </ShareIntentProvider>
  );
}
