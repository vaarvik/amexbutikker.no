import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { ValidationError } from '@amexbutikker/contracts';
import { ApiError } from '../../shared/fetch-json.transport';
import { useServices } from '../../ui/services';
import { usePalette } from '../../ui/theme';

/** What went wrong with the invite itself; null for anything else (offline etc.). */
function joinError(error: unknown): string | null {
  if (error instanceof ValidationError) {
    return 'Invitasjonen virker ikke. Be om en ny QR-kode.';
  }
  if (!(error instanceof ApiError)) {
    return null;
  }
  switch (error.status) {
    case 400:
      return 'Invitasjonen virker ikke. Be om en ny QR-kode.';
    case 404:
      return 'Husstanden finnes ikke lenger.';
    case 409:
      return 'Du er allerede med i en annen husstand, eller den er full.';
    default:
      return null;
  }
}

/** Opened by the invite link (`amexbutikker://household/join?invite=…`) from a QR code or a message. */
export default function JoinHouseholdScreen() {
  const { households, presenter } = useServices();
  const palette = usePalette();
  const { invite } = useLocalSearchParams<{ invite?: string }>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const close = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const join = () => {
    setBusy(true);
    setMessage(null);
    households
      .join(invite ?? '')
      .then(() => {
        router.replace('/household');
      })
      .catch((error: unknown) => {
        setMessage(joinError(error) ?? presenter.error(error));
        setBusy(false);
      });
  };

  return (
    <ScrollView
      style={{ backgroundColor: palette.background }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: palette.text }]} accessibilityRole="header">
        Bli med i husstanden?
      </Text>
      <Text style={[styles.body, { color: palette.muted }]}>
        Dere deler Bonus. Husstandens kort og mål erstatter dine.
      </Text>
      <Pressable
        onPress={join}
        disabled={busy}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: palette.accent, opacity: pressed || busy ? 0.7 : 1 },
        ]}
      >
        <Text style={[styles.buttonText, { color: palette.onAccent }]}>Bli med</Text>
      </Pressable>
      <Pressable
        onPress={close}
        accessibilityRole="button"
        style={({ pressed }) => [styles.later, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Text style={[styles.body, { color: palette.muted }]}>Avbryt</Text>
      </Pressable>
      {message === null ? null : (
        <Text style={[styles.body, { color: palette.text }]}>{message}</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 14, maxWidth: 640, width: '100%', alignSelf: 'center' },
  title: { fontSize: 24, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 22 },
  button: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  buttonText: { fontSize: 17, fontWeight: '600' },
  later: { alignItems: 'center', paddingVertical: 8 },
});
