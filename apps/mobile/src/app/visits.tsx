import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useServices } from '../ui/services';
import { usePalette } from '../ui/theme';

/** Turns visit questions on and off. Native only; the home screen hides the entry on the web. */
export default function VisitsScreen() {
  const { visits } = useServices();
  const palette = usePalette();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void visits?.isEnabled().then(setEnabled);
  }, [visits]);

  if (visits === null) {
    return null;
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

      {__DEV__ && enabled === true ? (
        <Pressable
          onPress={() => {
            void visits.sendTest().then((sent) => {
              setMessage(sent ? null : 'Ingen steder å spørre om ennå. Åpne forsiden først.');
            });
          }}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.card,
            styles.row,
            { backgroundColor: palette.card, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Text style={[styles.label, { color: palette.accent }]}>Send testvarsel</Text>
        </Pressable>
      ) : null}

      {message === null ? null : <Text style={[styles.note, text]}>{message}</Text>}
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
    minHeight: 52,
  },
  label: { fontSize: 17 },
  note: { fontSize: 14, lineHeight: 20, paddingHorizontal: 16 },
});
