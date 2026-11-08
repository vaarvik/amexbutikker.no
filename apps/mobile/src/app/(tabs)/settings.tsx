import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import type { WalletSetupState } from '../../payments/payments.model';
import { BonusGoalsSettings } from '../../ui/bonus-goals-settings';
import { useServices } from '../../ui/services';
import { usePalette } from '../../ui/theme';

/** App settings: bonus goals everywhere; visit questions and answers from Apple Pay in the native app. */
export default function SettingsScreen() {
  const { visits, walletSetup } = useServices();
  const palette = usePalette();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [walletState, setWalletState] = useState<WalletSetupState | null>(null);

  useEffect(() => {
    void visits?.isEnabled().then(setEnabled);
  }, [visits]);

  useFocusEffect(
    useCallback(() => {
      void walletSetup.find().then(setWalletState);
    }, [walletSetup]),
  );

  const toggle = (on: boolean) => {
    if (visits === null) {
      return;
    }
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
      <BonusGoalsSettings />

      {visits === null ? null : (
        <>
          <Text style={[styles.section, styles.gap, muted]}>BESØK</Text>
          <View style={[styles.card, { backgroundColor: palette.card }]}>
            <View style={styles.row}>
              <View style={styles.grow}>
                <Text style={[styles.label, text]}>Spør meg etter besøk</Text>
                <Text style={[styles.sub, muted]}>
                  Når du går ut av en butikk. Posisjonen blir på telefonen.
                </Text>
              </View>
              <Switch
                value={enabled === true}
                disabled={enabled === null || busy}
                onValueChange={toggle}
                accessibilityLabel="Spør meg etter besøk"
              />
            </View>
          </View>

          {__DEV__ && enabled === true ? (
            <>
              <Text style={[styles.section, styles.gap, muted]}>TEST (BARE I UTVIKLING)</Text>
              <View style={[styles.card, { backgroundColor: palette.card }]}>
                {(['ask', 'pick'] as const).map((kind, index) => (
                  <Pressable
                    key={kind}
                    onPress={() => {
                      void visits.sendTest(kind).then((sent) => {
                        setMessage(
                          sent ? null : 'Ingen steder å spørre om ennå. Åpne Steder først.',
                        );
                      });
                    }}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.row,
                      index === 0
                        ? null
                        : {
                            borderTopColor: palette.border,
                            borderTopWidth: StyleSheet.hairlineWidth,
                          },
                      { opacity: pressed ? 0.6 : 1 },
                    ]}
                  >
                    <Text style={[styles.label, { color: palette.accent }]}>
                      {kind === 'ask' ? 'Send testvarsel' : 'Send testvarsel med flere steder'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          {message === null ? null : <Text style={[styles.note, text]}>{message}</Text>}
        </>
      )}

      {Platform.OS === 'ios' ? (
        <>
          <Text style={[styles.section, styles.gap, muted]}>APPLE PAY</Text>
          <View style={[styles.card, { backgroundColor: palette.card }]}>
            <Pressable
              onPress={() => {
                router.push('/wallet-setup');
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Text style={[styles.label, text]}>Svar når du betaler</Text>
              <Text style={[styles.value, { color: palette.accent }]}>
                {walletState === 'done' ? 'På ›' : 'Sett opp ›'}
              </Text>
            </Pressable>
          </View>
          {__DEV__ ? (
            <>
              <Text style={[styles.section, styles.gap, muted]}>TEST (BARE I UTVIKLING)</Text>
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
            </>
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
  grow: { flex: 1, gap: 2 },
  sub: { fontSize: 13 },
  value: { fontSize: 17 },
  section: { fontSize: 13, paddingHorizontal: 16, marginBottom: -4 },
  gap: { marginTop: 16 },
  note: { fontSize: 14, lineHeight: 20, paddingHorizontal: 16 },
});
