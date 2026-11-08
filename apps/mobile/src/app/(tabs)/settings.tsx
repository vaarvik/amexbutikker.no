import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useServices } from '../../ui/services';
import { usePalette } from '../../ui/theme';

/** The setup with the shared shortcut, in the words of Norwegian iOS. See docs/wallet-shortcut.md. */
const SHORTCUT_STEPS = [
  'Trykk «Legg til snarveien» over og legg den til.',
  'Åpne Snarveier, gå til Automatisering og trykk +.',
  'Velg Transaksjon, kryss av for Amex-kortet ditt og velg Kjør umiddelbart.',
  'Velg snarveien «Tar de Amex?» som handling. Ferdig.',
] as const;

/** The same automation built by hand, until a shared shortcut exists. */
const MANUAL_STEPS = [
  'Åpne Snarveier, gå til Automatisering og trykk +.',
  'Velg Transaksjon, kryss av for Amex-kortet ditt og velg Kjør umiddelbart.',
  'Legg til URL-kod to ganger: én for Forhandler og én for Beløp fra Snarvei-inndata.',
  'Legg til Åpne URL-er med lenken under, og sett inn de to kodede verdiene.',
] as const;

const MANUAL_LINK = 'amexbutikker://paid?merchant=[Forhandler]&amount=[Beløp]';

/** App settings: visit questions and answers from Apple Pay, both in the native app only. */
export default function SettingsScreen() {
  const { visits, walletShortcutUrl } = useServices();
  const palette = usePalette();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void visits?.isEnabled().then(setEnabled);
  }, [visits]);

  if (visits === null) {
    return (
      <View style={[styles.empty, { backgroundColor: palette.background }]}>
        <Text style={[styles.note, { color: palette.muted }]}>
          Ingen innstillinger på nettet ennå.
        </Text>
      </View>
    );
  }

  const toggle = (on: boolean) => {
    setBusy(true);
    setMessage(null);
    (on ? visits.enable() : visits.disable().then(() => false))
      .then((now) => {
        setEnabled(now);
        if (on && !now) {
          setMessage(
            'Appen fikk ikke lov til å bruke posisjon hele tiden eller sende varsler. Du kan endre det i Innstillinger.',
          );
        }
      })
      .catch(() => {
        setMessage('Noe gikk galt. Prøv igjen.');
      })
      .finally(() => {
        setBusy(false);
      });
  };

  const text = { color: palette.text };
  const muted = { color: palette.muted };

  return (
    <ScrollView
      style={{ backgroundColor: palette.background }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.section, muted]}>BESØK</Text>
      <View style={[styles.card, { backgroundColor: palette.card }]}>
        <View style={styles.row}>
          <Text style={[styles.label, text]}>Spør meg etter besøk</Text>
          <Switch
            value={enabled === true}
            disabled={enabled === null || busy}
            onValueChange={toggle}
            accessibilityLabel="Spør meg etter besøk"
          />
        </View>
      </View>
      <Text style={[styles.note, muted]}>
        Når du går ut av en butikk der ingen har svart ennå, spør appen om du fikk betale med Amex.
        Der Amex funker, får du beskjed når du kommer inn. Høyst tre spørsmål om dagen.
      </Text>
      <Text style={[styles.note, muted]}>
        Posisjonen din lagres bare på telefonen. Bare svaret ditt sendes.
      </Text>

      {__DEV__ && enabled === true
        ? (['ask', 'pick'] as const).map((kind) => (
            <Pressable
              key={kind}
              onPress={() => {
                void visits.sendTest(kind).then((sent) => {
                  setMessage(sent ? null : 'Ingen steder å spørre om ennå. Åpne Steder først.');
                });
              }}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.card,
                styles.row,
                { backgroundColor: palette.card, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Text style={[styles.label, { color: palette.accent }]}>
                {kind === 'ask' ? 'Send testvarsel' : 'Send testvarsel med flere steder'}
              </Text>
            </Pressable>
          ))
        : null}

      {message === null ? null : <Text style={[styles.note, text]}>{message}</Text>}

      {Platform.OS === 'ios' ? (
        <>
          <Text style={[styles.section, styles.gap, muted]}>APPLE PAY</Text>
          <View style={[styles.card, { backgroundColor: palette.card }]}>
            {walletShortcutUrl === null ? (
              <View style={styles.row}>
                <Text style={[styles.label, text]}>Svar automatisk når du betaler</Text>
              </View>
            ) : (
              <Pressable
                onPress={() => {
                  void Linking.openURL(walletShortcutUrl);
                }}
                accessibilityRole="link"
                style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Text style={[styles.label, { color: palette.accent }]}>Legg til snarveien</Text>
              </Pressable>
            )}
          </View>
          <Text style={[styles.note, muted]}>
            Med en snarvei svarer appen for deg når du betaler med Amex i Apple Wallet: finner appen
            stedet, lagres «Tar Amex» der, og du kan angre. Beløpet legges i Bonus og blir på
            telefonen. Bare navnet på butikken og posisjonen din sendes.
          </Text>
          {(walletShortcutUrl === null ? MANUAL_STEPS : SHORTCUT_STEPS).map((step, index) => (
            <Text key={step} style={[styles.note, muted]}>
              {`${String(index + 1)}. ${step}`}
            </Text>
          ))}
          {walletShortcutUrl === null ? (
            <Text selectable style={[styles.note, styles.code, text]}>
              {MANUAL_LINK}
            </Text>
          ) : null}
          {__DEV__ ? (
            <Pressable
              onPress={() => {
                router.push({
                  pathname: '/paid',
                  params: { merchant: 'Kafé Åsen', amount: 'kr 49,00' },
                });
              }}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.card,
                styles.row,
                { backgroundColor: palette.card, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Text style={[styles.label, { color: palette.accent }]}>Send testbetaling</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, maxWidth: 640, width: '100%', alignSelf: 'center' },
  card: { borderRadius: 12, paddingHorizontal: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 11,
  },
  label: { fontSize: 17, flex: 1 },
  section: { fontSize: 13, paddingHorizontal: 16, marginBottom: -4 },
  gap: { marginTop: 16 },
  code: { fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }), fontSize: 13 },
  empty: { flex: 1, paddingTop: 24 },
  note: { fontSize: 14, lineHeight: 20, paddingHorizontal: 16 },
});
