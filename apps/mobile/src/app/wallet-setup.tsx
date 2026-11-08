import { router } from 'expo-router';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useServices } from '../ui/services';
import { usePalette } from '../ui/theme';

/** The automation built by hand, until a shared shortcut exists. */
const STEPS = [
  'Åpne Snarveier, gå til Automatisering og trykk +.',
  'Velg Transaksjon, kryss av for Amex-kortet ditt og velg Kjør umiddelbart.',
  'Legg til URL-kod to ganger: én for Forhandler og én for Beløp fra Snarvei-inndata.',
  'Legg til Åpne URL-er med lenken under, og sett inn de to kodede verdiene.',
] as const;

const LINK = 'amexbutikker://paid?merchant=[Forhandler]&amount=[Beløp]';

/** Sets up the Shortcuts automation that opens the app after every Amex payment in Apple Pay. */
export default function WalletSetupScreen() {
  const { walletSetup, walletShortcutUrl } = useServices();
  const palette = usePalette();
  const text = { color: palette.text };
  const muted = { color: palette.muted };

  const finish = (state: 'done' | 'dismissed') => {
    void walletSetup.save(state).finally(() => {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/');
      }
    });
  };

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
        går til Bonus og blir på telefonen. Tar et par minutter i Snarveier.
      </Text>

      {walletShortcutUrl === null ? (
        <View style={[styles.card, { backgroundColor: palette.card }]}>
          {STEPS.map((step, index) => (
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
                <Text style={[styles.numberText, { color: palette.accent }]}>
                  {String(index + 1)}
                </Text>
              </View>
              <Text style={[styles.stepText, text]}>{step}</Text>
            </View>
          ))}
          <View
            style={[
              styles.linkRow,
              { borderTopColor: palette.border, borderTopWidth: StyleSheet.hairlineWidth },
            ]}
          >
            <Text selectable style={[styles.code, text]}>
              {LINK}
            </Text>
            <Pressable
              onPress={() => {
                void Share.share({ message: LINK });
              }}
              accessibilityRole="button"
              accessibilityLabel="Kopier lenken"
              hitSlop={8}
            >
              <Text style={[styles.copy, { color: palette.accent }]}>Kopier</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <Pressable
        onPress={() => {
          void Linking.openURL(walletShortcutUrl ?? 'shortcuts://');
        }}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: palette.accent, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Text style={[styles.buttonText, { color: palette.onAccent }]}>
          {walletShortcutUrl === null ? 'Åpne Snarveier' : 'Legg til snarveien'}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => {
          finish('done');
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
        onPress={() => {
          finish('dismissed');
        }}
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
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  code: {
    flex: 1,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 12,
  },
  copy: { fontSize: 15, fontWeight: '600' },
  button: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  outlined: { borderWidth: 1.5 },
  buttonText: { fontSize: 17, fontWeight: '600' },
  later: { alignItems: 'center', paddingVertical: 8 },
});
