import type {
  AcceptanceResult,
  MatchCandidateDto,
  PlaceId,
  PlaceStatusDto,
} from '@amexbutikker/contracts';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PaymentOutcome } from '../payments/payments.model';
import type { Purchase } from '../spending/spending.model';
import { CategoryIcon } from '../ui/category-icon';
import { useServices } from '../ui/services';
import { StatusAnswer } from '../ui/status-badge';
import { STATUS_COLORS, usePalette } from '../ui/theme';

type Screen =
  | { readonly type: 'loading' }
  | { readonly type: 'invalid' }
  | PaymentOutcome
  /** After "Feil sted" or "Angre": the user picks the place by hand. */
  | {
      readonly type: 'pick';
      readonly merchantName: string;
      readonly candidates: readonly MatchCandidateDto[];
      readonly purchase: Purchase | null;
    };

type RowState = 'idle' | 'sending' | AcceptanceResult | 'failed';

/**
 * Opened by the Shortcuts "Transaction" automation after a payment with the card in Apple
 * Wallet: `amexbutikker://paid?merchant=…&amount=…`. See docs/wallet-shortcut.md.
 */
export default function PaidScreen() {
  const params = useLocalSearchParams();
  const { payments, walletLinks, spendingPresenter, presenter } = useServices();
  const palette = usePalette();
  // Read once: the link does not change while the screen is open.
  const [payment] = useState(() => walletLinks.parse(params));
  const [screen, setScreen] = useState<Screen>(
    payment === null ? { type: 'invalid' } : { type: 'loading' },
  );
  const [rows, setRows] = useState<Readonly<Record<string, RowState>>>({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // Once per screen: the payment must not be handled twice when the effect runs again.
    if (payment === null || started.current) {
      return;
    }
    started.current = true;
    void payments.handle(payment).then(setScreen);
  }, [payment, payments]);

  const text = { color: palette.text };
  const muted = { color: palette.muted };
  const purchase = 'purchase' in screen ? screen.purchase : null;
  const amountNote =
    purchase === null ? null : `${spendingPresenter.amount(purchase.amountNok)} er lagt i Bonus.`;

  const close = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  // Ferdig sits in the header (where iOS puts it on a sheet) and as a full button at the bottom.
  const header = (
    <Stack.Screen
      options={{
        headerRight: () => (
          <Pressable onPress={close} accessibilityRole="button" hitSlop={12}>
            <Text style={[styles.headerButton, { color: palette.accent }]}>Ferdig</Text>
          </Pressable>
        ),
      }}
    />
  );

  /** Filled where it is the main way on; outlined next to another filled button. */
  const doneButton = (primary: boolean) => (
    <Pressable
      onPress={close}
      accessibilityRole="button"
      style={({ pressed }) => [
        primary
          ? [styles.primary, { backgroundColor: palette.accent }]
          : [styles.secondary, styles.wide, { borderColor: palette.border }],
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Text
        style={
          primary
            ? [styles.primaryText, { color: palette.onAccent }]
            : [styles.secondaryText, { color: palette.text }]
        }
      >
        Ferdig
      </Text>
    </Pressable>
  );
  const done = doneButton(true);

  const answerRow = (placeId: PlaceId, result: AcceptanceResult) => {
    setRows((current) => ({ ...current, [placeId]: 'sending' }));
    payments
      .answer(placeId, result, purchase)
      .then(() => {
        setRows((current) => ({ ...current, [placeId]: result }));
        if (result === 'rejected' && purchase !== null) {
          setNote('Beløpet er tatt ut av Bonus, siden kortet ble avvist.');
        }
      })
      .catch(() => {
        setRows((current) => ({ ...current, [placeId]: 'failed' }));
      });
  };

  /** Runs an action on the answered place and shows what came of it. */
  const act = (
    action: () => Promise<{ readonly status: PlaceStatusDto }>,
    then: (status: PlaceStatusDto) => void,
  ) => {
    setBusy(true);
    setNote(null);
    action()
      .then(({ status }) => {
        then(status);
      })
      .catch(() => {
        setNote('Noe gikk galt. Prøv igjen.');
      })
      .finally(() => {
        setBusy(false);
      });
  };

  let body: ReactNode;
  switch (screen.type) {
    case 'loading':
      body = (
        <View style={styles.center}>
          <ActivityIndicator color={palette.accent} />
          <Text style={[styles.note, muted]}>Finner stedet du betalte …</Text>
        </View>
      );
      break;
    case 'invalid':
      body = <Text style={[styles.note, muted]}>Denne lenken er ikke gyldig.</Text>;
      break;
    case 'duplicate':
      body = (
        <>
          <Text style={[styles.note, muted]}>Denne betalingen er allerede registrert.</Text>
          {done}
        </>
      );
      break;
    case 'offline':
      body = (
        <>
          <Text style={[styles.note, text]}>
            Fikk ikke kontakt, så stedet for «{screen.merchantName}» er ikke funnet ennå.
          </Text>
          {amountNote === null ? null : <Text style={[styles.note, muted]}>{amountNote}</Text>}
          <Pressable
            onPress={() => {
              setScreen({ type: 'loading' });
              void payments.retry(screen.merchantName, screen.purchase).then(setScreen);
            }}
            accessibilityRole="button"
            style={[styles.primary, { backgroundColor: palette.accent }]}
          >
            <Text style={[styles.primaryText, { color: palette.onAccent }]}>Prøv igjen</Text>
          </Pressable>
          {doneButton(false)}
        </>
      );
      break;
    case 'none':
      body = (
        <>
          <Text style={[styles.note, text]}>
            Fant ikke «{screen.merchantName}» blant stedene i nærheten.
          </Text>
          {amountNote === null ? null : <Text style={[styles.note, muted]}>{amountNote}</Text>}
          <Pressable
            onPress={() => {
              router.replace({ pathname: '/add', params: { name: screen.merchantName } });
            }}
            accessibilityRole="button"
            style={[styles.primary, { backgroundColor: palette.accent }]}
          >
            <Text style={[styles.primaryText, { color: palette.onAccent }]}>Legg til stedet</Text>
          </Pressable>
          {doneButton(false)}
        </>
      );
      break;
    case 'answered': {
      const { candidate, status } = screen;
      body = (
        <>
          <Text style={[styles.note, text]}>
            Takk! Du betalte med Amex hos {candidate.place.name}, så vi har lagret at de tar Amex.
          </Text>
          <View style={[styles.group, styles.answered, { backgroundColor: palette.card }]}>
            <View style={styles.place}>
              <CategoryIcon category={candidate.place.category} />
              <View style={styles.text}>
                <Text style={[styles.name, text]} numberOfLines={1}>
                  {candidate.place.name}
                </Text>
                <Text style={muted} numberOfLines={1}>
                  {presenter.address(candidate.place) ??
                    presenter.category(candidate.place.category)}
                </Text>
              </View>
            </View>
            <StatusAnswer
              status={status.status}
              {...(status.status === 'likely_accepted'
                ? { note: 'Ett svar til fra noen, så blir det Ja' }
                : {})}
            />
          </View>
          {amountNote === null ? null : <Text style={[styles.note, muted]}>{amountNote}</Text>}
          <View style={styles.actions}>
            <Pressable
              disabled={busy}
              onPress={() => {
                act(
                  () => payments.answer(candidate.place.id, 'rejected', screen.purchase),
                  (next) => {
                    setScreen({ ...screen, status: next, purchase: null });
                    setNote(
                      screen.purchase === null
                        ? 'Lagret: kortet ble avvist.'
                        : 'Lagret: kortet ble avvist. Beløpet er tatt ut av Bonus.',
                    );
                  },
                );
              }}
              accessibilityRole="button"
              style={[styles.secondary, { borderColor: palette.border }]}
            >
              <Text style={[styles.secondaryText, text]}>Kortet ble avvist</Text>
            </Pressable>
            <Pressable
              disabled={busy}
              onPress={() => {
                act(
                  () => payments.undo(candidate.place.id),
                  () => {
                    setScreen({
                      type: 'pick',
                      merchantName: candidate.place.name,
                      candidates: screen.candidates,
                      purchase: screen.purchase,
                    });
                    setNote('Svaret er tatt bort.');
                  },
                );
              }}
              accessibilityRole="button"
              style={[styles.secondary, { borderColor: palette.border }]}
            >
              <Text style={[styles.secondaryText, text]}>Angre</Text>
            </Pressable>
          </View>
          <Pressable
            disabled={busy}
            onPress={() => {
              act(
                () => payments.undo(candidate.place.id),
                () => {
                  setScreen({
                    type: 'pick',
                    merchantName: candidate.place.name,
                    candidates: screen.candidates.filter(
                      (other) => other.place.id !== candidate.place.id,
                    ),
                    purchase: screen.purchase,
                  });
                  setNote(null);
                },
              );
            }}
            accessibilityRole="button"
            hitSlop={8}
            style={styles.done}
          >
            <Text style={[styles.link, { color: palette.accent }]}>Feil sted?</Text>
          </Pressable>
          {done}
        </>
      );
      break;
    }
    case 'choose':
    case 'pick': {
      const candidates = screen.candidates;
      body = (
        <>
          <Text style={[styles.note, muted]}>
            {candidates.length === 0
              ? 'Finn stedet i søket eller legg det til, så teller svaret ditt der.'
              : `Flere steder passer med «${screen.merchantName}». Velg der du betalte.`}
          </Text>
          {amountNote === null ? null : <Text style={[styles.note, muted]}>{amountNote}</Text>}
          {candidates.length === 0 ? null : (
            <View style={[styles.group, { backgroundColor: palette.card }]}>
              {candidates.map((candidate, index) => {
                const row = rows[candidate.place.id] ?? 'idle';
                return (
                  <View
                    key={candidate.place.id}
                    style={[
                      styles.row,
                      index === candidates.length - 1
                        ? null
                        : {
                            borderBottomWidth: StyleSheet.hairlineWidth,
                            borderColor: palette.border,
                          },
                    ]}
                  >
                    <View style={styles.place}>
                      <CategoryIcon category={candidate.place.category} />
                      <View style={styles.text}>
                        <Text style={[styles.name, text]} numberOfLines={1}>
                          {candidate.place.name}
                        </Text>
                        <Text style={muted}>
                          {row === 'failed'
                            ? 'Noe gikk galt. Prøv igjen.'
                            : row === 'accepted'
                              ? 'Takk! Lagret: tar Amex.'
                              : row === 'rejected'
                                ? 'Takk! Lagret: ble avvist.'
                                : (presenter.address(candidate.place) ?? '')}
                        </Text>
                      </View>
                    </View>
                    {row === 'accepted' || row === 'rejected' ? null : (
                      <View style={styles.buttons}>
                        {(['accepted', 'rejected'] as const).map((result) => (
                          <Pressable
                            key={result}
                            disabled={row === 'sending'}
                            onPress={() => {
                              answerRow(candidate.place.id, result);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={`${candidate.place.name}: ${result === 'accepted' ? 'Det funket' : 'Ble avvist'}`}
                            style={({ pressed }) => [
                              styles.answer,
                              {
                                backgroundColor: STATUS_COLORS[result],
                                opacity: pressed || row === 'sending' ? 0.7 : 1,
                              },
                            ]}
                          >
                            <Text style={styles.answerText}>
                              {result === 'accepted' ? 'Det funket' : 'Ble avvist'}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
          <Pressable
            onPress={() => {
              router.replace({ pathname: '/add', params: { name: screen.merchantName } });
            }}
            accessibilityRole="button"
            hitSlop={8}
            style={styles.done}
          >
            <Text style={[styles.link, { color: palette.accent }]}>
              {candidates.length === 0 ? 'Legg til stedet' : 'Ingen av disse: legg til stedet'}
            </Text>
          </Pressable>
          {done}
        </>
      );
      break;
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: palette.background }}
      contentContainerStyle={styles.content}
    >
      {header}
      {body}
      {note === null ? null : (
        <Text accessibilityLiveRegion="polite" style={[styles.note, text]}>
          {note}
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, maxWidth: 640, width: '100%', alignSelf: 'center' },
  center: { alignItems: 'center', gap: 12, paddingTop: 32 },
  note: { fontSize: 15, lineHeight: 21, paddingHorizontal: 4 },
  group: { borderRadius: 12, paddingHorizontal: 14 },
  answered: { paddingVertical: 14, gap: 12 },
  row: { paddingVertical: 12, gap: 10 },
  place: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  text: { flex: 1, gap: 2 },
  name: { fontSize: 17, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8 },
  secondary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    paddingVertical: 12,
    minHeight: 44,
  },
  secondaryText: { fontSize: 15, fontWeight: '600' },
  wide: { flex: 0, alignSelf: 'stretch' },
  primary: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', minHeight: 48 },
  primaryText: { fontSize: 17, fontWeight: '700' },
  buttons: { flexDirection: 'row', gap: 8, paddingLeft: 48 },
  answer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 10,
    minHeight: 44,
  },
  answerText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  done: { alignSelf: 'center', paddingVertical: 8 },
  link: { fontSize: 17 },
  headerButton: { fontSize: 17, fontWeight: '600' },
});
