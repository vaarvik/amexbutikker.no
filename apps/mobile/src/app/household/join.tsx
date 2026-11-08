import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useServices } from '../../ui/services';
import { usePalette } from '../../ui/theme';

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
        setMessage(presenter.error(error));
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
