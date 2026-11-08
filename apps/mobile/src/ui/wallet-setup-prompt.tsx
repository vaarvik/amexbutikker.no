import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { WalletSetupState } from '../payments/payments.model';
import { useServices } from './services';
import { usePalette } from './theme';

/**
 * Asks on Steder to set up answers from Apple Pay until it is set up. "Ikke nå" hides it until
 * the app starts again (the tab stays mounted, so this state lives as long as the app).
 */
export function WalletSetupPrompt() {
  const { walletSetup, native } = useServices();
  const palette = usePalette();
  const [state, setState] = useState<WalletSetupState | null>(null);
  const [hidden, setHidden] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void walletSetup.find().then(setState);
    }, [walletSetup]),
  );

  if (!native || Platform.OS !== 'ios' || state !== 'new' || hidden) {
    return null;
  }
  return (
    <View style={[styles.card, { backgroundColor: palette.accentSoft }]}>
      <Text style={[styles.title, { color: palette.text }]}>Svar automatisk når du betaler</Text>
      <Text style={[styles.body, { color: palette.muted }]}>
        Betal med Amex i Apple Pay, så lagrer appen at stedet tar Amex.
      </Text>
      <View style={styles.actions}>
        <Pressable
          onPress={() => {
            router.push('/wallet-setup');
          }}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: palette.accent, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[styles.buttonText, { color: palette.onAccent }]}>Sett opp</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setHidden(true);
          }}
          accessibilityRole="button"
          hitSlop={8}
        >
          <Text style={[styles.later, { color: palette.accent }]}>Ikke nå</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, padding: 16, gap: 6, marginTop: 20, marginHorizontal: 20 },
  title: { fontSize: 17, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 21 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 8 },
  button: { borderRadius: 10, paddingHorizontal: 18, paddingVertical: 9 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  later: { fontSize: 16, fontWeight: '500' },
});
