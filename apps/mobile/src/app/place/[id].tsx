import { PlaceIdSchema } from '@amexbutikker/contracts';
import type { AcceptanceResult, PlaceDetailsResponseDto, PlaceId } from '@amexbutikker/contracts';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useServices } from '../../ui/services';
import { CategoryIcon } from '../../ui/category-icon';
import { StatusAnswer } from '../../ui/status-badge';
import { usePalette } from '../../ui/theme';

type DetailsState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly details: PlaceDetailsResponseDto }
  | { readonly kind: 'failed'; readonly message: string };

const REPORT_LABELS: Readonly<Record<AcceptanceResult, string>> = {
  accepted: '✓ Det funket',
  rejected: '✕ Ble avvist',
};

export default function PlaceScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const parsed = PlaceIdSchema.safeParse(params.id);
  const palette = usePalette();
  if (!parsed.success) {
    return (
      <Text style={[styles.message, { color: palette.muted }]}>Denne lenken er ikke gyldig.</Text>
    );
  }
  return <PlaceDetails placeId={parsed.data} />;
}

function PlaceDetails(props: { readonly placeId: PlaceId }) {
  const { places, presenter } = useServices();
  const palette = usePalette();
  const [state, setState] = useState<DetailsState>({ kind: 'loading' });
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const load = useCallback(() => {
    places
      .getDetails(props.placeId)
      .then((details) => {
        setState({ kind: 'ready', details });
      })
      .catch((error: unknown) => {
        setState({ kind: 'failed', message: presenter.error(error) });
      });
  }, [places, presenter, props.placeId]);

  useEffect(load, [load]);

  const send = (action: () => Promise<unknown>) => {
    setSending(true);
    setSendError(null);
    action()
      // The response carries the new status; reload for the basis sentence and notes as well.
      .then(load)
      .catch((error: unknown) => {
        setSendError(presenter.error(error));
      })
      .finally(() => {
        setSending(false);
      });
  };

  if (state.kind === 'loading') {
    return <ActivityIndicator style={styles.spinner} />;
  }
  if (state.kind === 'failed') {
    return (
      <View style={styles.message}>
        <Text style={{ color: palette.muted }}>{state.message}</Text>
        <Pressable onPress={load} accessibilityRole="button" hitSlop={8}>
          <Text style={[styles.link, { color: palette.accent }]}>Prøv igjen</Text>
        </Pressable>
      </View>
    );
  }

  const { details } = state;
  const address = presenter.address(details.place);
  const chainHint = presenter.chainHint(details);
  const text = { color: palette.text };
  const muted = { color: palette.muted };

  const unknown = details.status.status === 'unknown';
  const card = [styles.card, { backgroundColor: palette.card }];

  return (
    <ScrollView
      style={{ backgroundColor: palette.background }}
      contentContainerStyle={styles.content}
    >
      <Stack.Screen options={{ title: '' }} />
      <View style={styles.heading}>
        <CategoryIcon category={details.place.category} size={48} />
        <View style={styles.headingText}>
          <Text style={[styles.name, text]} accessibilityRole="header">
            {details.place.name}
          </Text>
          <Text style={muted}>
            {[presenter.category(details.place.category), address]
              .filter((part) => part !== null)
              .join(' · ')}
          </Text>
        </View>
      </View>

      <StatusAnswer status={details.status.status} />

      {unknown && details.basis.kind === null ? null : (
        <View style={card}>
          {details.status.verified ? (
            <Text style={[styles.verified, { color: palette.accent }]}>
              ✓ Bekreftet med kjøp eller besøk
            </Text>
          ) : null}
          <Text style={[styles.body, text]}>{presenter.basis(details)}</Text>
          {chainHint === null ? null : <Text style={[styles.body, muted]}>{chainHint}</Text>}
        </View>
      )}

      <View style={card}>
        <Text style={[styles.cardTitle, text]}>Har du betalt med Amex her?</Text>
        {unknown ? (
          <Text style={[styles.body, text]}>
            Ingen har fortalt oss om stedet tar Amex ennå. Har du prøvd å betale her? Ett trykk, så
            vet neste person svaret.
          </Text>
        ) : null}
        <View style={styles.buttons}>
          {(['accepted', 'rejected'] as const).map((result) => {
            const chosen = details.myReport === result;
            return (
              <Pressable
                key={result}
                disabled={sending}
                onPress={() => {
                  send(() => places.submitReport(props.placeId, { result }));
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: chosen, disabled: sending }}
                style={({ pressed }) => [
                  styles.button,
                  {
                    borderColor: palette.accent,
                    backgroundColor: chosen ? palette.accent : palette.card,
                    opacity: pressed || sending ? 0.7 : 1,
                  },
                ]}
              >
                <Text
                  style={[styles.buttonText, { color: chosen ? palette.onAccent : palette.accent }]}
                >
                  {REPORT_LABELS[result]}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {details.myReport === null ? null : (
          <Pressable
            disabled={sending}
            onPress={() => {
              send(() => places.removeMyReport(props.placeId));
            }}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Text style={[styles.link, { color: palette.accent }]}>Angre min rapport</Text>
          </Pressable>
        )}
        {sendError === null ? null : <Text style={[styles.body, text]}>{sendError}</Text>}
      </View>

      {details.latestNotes.length === 0 ? null : (
        <View style={card}>
          <Text style={[styles.cardTitle, text]}>Siste kommentarer</Text>
          {details.latestNotes.map((note) => (
            <Text key={`${note.observedAt}-${note.note}`} style={[styles.body, muted]}>
              {presenter.status(note.result).symbol} {note.note}
            </Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14, maxWidth: 640, width: '100%', alignSelf: 'center' },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 4 },
  headingText: { flex: 1, gap: 2 },
  name: { fontSize: 24, fontWeight: '700' },
  card: { borderRadius: 12, padding: 16, gap: 10 },
  cardTitle: { fontSize: 17, fontWeight: '600' },
  verified: { fontSize: 15, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 22 },
  buttons: { flexDirection: 'row', gap: 12 },
  button: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 48,
  },
  buttonText: { fontSize: 17, fontWeight: '700' },
  link: { fontSize: 16, fontWeight: '600', paddingVertical: 8 },
  message: { padding: 16, gap: 10 },
  spinner: { marginTop: 48 },
});
