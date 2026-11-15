import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { WalletSetupState } from '../payments/payments.model';
import { useServices } from '../ui/services';
import { usePalette } from '../ui/theme';

/**
 * The automation runs the app's own action (the App Intent in plugins/payment-intent), so there is
 * no link to type. iOS lets only the user create an automation.
 */
const STEPS = [
  'Trykk Åpne Snarveier, gå til Automatisering og trykk +. Velg Transaksjon.',
  'Velg Amex-kortet ditt og Kjør umiddelbart, og trykk Neste.',
  'Søk etter «Registrer Amex-betaling» og velg den. Trykk Forhandler og velg Forhandler, så Beløp og velg Beløp.',
] as const;

/** Optional: a second automation for the other cards, so the app can ask "Tok de ikke Amex?". */
const OTHER_STEPS = [
  'Lag en ny Transaksjon-automatisering og velg de andre kortene dine.',
  'Søk etter «Registrer annen betaling». Trykk Forhandler og velg Forhandler.',
] as const;

/** The app cannot remove an automation; the user does it in Snarveier. */
const REMOVE_STEPS = [
  'Åpne Snarveier og gå til Automatisering.',
  'Sveip til venstre på Transaksjon-automatiseringene og trykk Slett.',
] as const;

function close() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/');
  }
}

/**
 * Sets up the Shortcuts automation that opens the app after every Amex payment in Apple Pay or,
 * once it is set up, shows how to remove it.
 */
export default function WalletSetupScreen() {
  const { walletSetup } = useServices();
  const [state, setState] = useState<WalletSetupState | null>(null);

  useEffect(() => {
    void walletSetup.find().then(setState);
  }, [walletSetup]);

  if (state === null) {
    return null;
  }
  return state === 'done' ? <RemoveSetup /> : <SetUp />;
}

function RemoveSetup() {
  const { walletSetup } = useServices();
  const palette = usePalette();
  const text = { color: palette.text };
  const muted = { color: palette.muted };
  return (
    <ScrollView
      style={{ backgroundColor: palette.background }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, text]} accessibilityRole="header">
        Satt opp
      </Text>
      <Text style={[styles.body, muted]}>
        Appen åpner seg når du betaler med Amex i Apple Pay. Vil du slå det av, sletter du
        automatiseringen i Snarveier.
      </Text>
      <Steps steps={REMOVE_STEPS} />
      <Pressable
        onPress={() => {
          void Linking.openURL('shortcuts://');
        }}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: palette.accent, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Text style={[styles.buttonText, { color: palette.onAccent }]}>Åpne Snarveier</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          void walletSetup.save('new').finally(close);
        }}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.button,
          styles.outlined,
          { borderColor: palette.accent, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Text style={[styles.buttonText, { color: palette.accent }]}>Den er slettet</Text>
      </Pressable>
    </ScrollView>
  );
}

/** Numbered steps in a card; `footer` goes under the last one. */
function Steps(props: { readonly steps: readonly string[]; readonly footer?: ReactNode }) {
  const palette = usePalette();
  return (
    <View style={[styles.card, { backgroundColor: palette.card }]}>
      {props.steps.map((step, index) => (
        <View
          key={step}
          style={[
            styles.step,
            index === 0
              ? null
              : { borderTopColor: palette.border, borderTopWidth: StyleSheet.hairlineWidth },
          ]}
        >
          <View style={[styles.number, { backgroundColor: palette.accentSoft }]}>
            <Text style={[styles.numberText, { color: palette.accent }]}>{String(index + 1)}</Text>
          </View>
          <Text style={[styles.stepText, { color: palette.text }]}>{step}</Text>
        </View>
      ))}
      {props.footer}
    </View>
  );
}

function SetUp() {
  const { walletSetup } = useServices();
  const palette = usePalette();
  const text = { color: palette.text };
  const muted = { color: palette.muted };

  return (
    <ScrollView
      style={{ backgroundColor: palette.background }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, text]} accessibilityRole="header">
        Svar med én gang du betaler
      </Text>
      <Text style={[styles.body, muted]}>
        Når du betaler med Amex i Apple Pay, åpner appen seg og lagrer at stedet tar Amex. Beløpet
        går til Bonus og blir på telefonen. Tar ett minutt i Snarveier.
      </Text>

      <Steps steps={STEPS} />

      <Text style={[styles.subtitle, text]}>Valgfritt: andre kort</Text>
      <Text style={[styles.body, muted]}>
        Betaler du med et annet kort, spør appen om stedet ikke tok Amex.
      </Text>
      <Steps steps={OTHER_STEPS} />

      <Pressable
        onPress={() => {
          void Linking.openURL('shortcuts://');
        }}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: palette.accent, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Text style={[styles.buttonText, { color: palette.onAccent }]}>Åpne Snarveier</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          void walletSetup.save('done').finally(close);
        }}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.button,
          styles.outlined,
          { borderColor: palette.accent, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Text style={[styles.buttonText, { color: palette.accent }]}>Det er satt opp</Text>
      </Pressable>
      <Pressable
        onPress={close}
        accessibilityRole="button"
        style={({ pressed }) => [styles.later, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Text style={[styles.body, muted]}>Ikke nå</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 14, maxWidth: 640, width: '100%', alignSelf: 'center' },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 18, fontWeight: '700', marginTop: 8 },
  body: { fontSize: 16, lineHeight: 22 },
  card: { borderRadius: 12, paddingHorizontal: 16, marginVertical: 6 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
  number: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: { fontSize: 14, fontWeight: '700' },
  stepText: { flex: 1, fontSize: 16, lineHeight: 22 },
  button: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  outlined: { borderWidth: 1.5 },
  buttonText: { fontSize: 17, fontWeight: '600' },
  later: { alignItems: 'center', paddingVertical: 8 },
});
