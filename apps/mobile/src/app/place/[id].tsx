import { PlaceIdSchema } from '@amexbutikker/contracts';
import type { AcceptanceResult, PlaceDetailsResponseDto, PlaceId } from '@amexbutikker/contracts';
import { Stack, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { SymbolViewProps } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useServices } from '../../ui/services';
import { CategoryIcon } from '../../ui/category-icon';
import { StatusAnswer } from '../../ui/status-badge';
import { STATUS_COLORS, usePalette } from '../../ui/theme';

type DetailsState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly details: PlaceDetailsResponseDto }
  | { readonly kind: 'failed'; readonly message: string };

const REPORT_LABELS: Readonly<Record<AcceptanceResult, string>> = {
  accepted: 'Det funket',
  rejected: 'Ble avvist',
};

const REPORT_ICONS: Readonly<Record<AcceptanceResult, SymbolViewProps['name']>> = {
  accepted: { ios: 'checkmark', android: 'check', web: 'check' },
  rejected: { ios: 'xmark', android: 'close', web: 'close' },
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
        <Text style={[styles.cardTitle, text]}>Fikk du betale med Amex her?</Text>
        <Text style={muted}>
          {details.myReport === null
            ? 'Svaret ditt vises for alle som sjekker stedet.'
            : 'Takk! Du kan endre svaret ditt.'}
        </Text>
        <View style={styles.buttons}>
          {(['accepted', 'rejected'] as const).map((result) => {
            const chosen = details.myReport === result;
            // Both buttons are solid until the user has answered; then the answer stays solid.
            const solid = details.myReport === null || chosen;
            const color = STATUS_COLORS[result];
            return (
              <Pressable
                key={result}
                disabled={sending}
                onPress={() => {
                  send(() => places.submitReport(props.placeId, { result }));
                }}
                accessibilityRole="button"
                accessibilityLabel={REPORT_LABELS[result]}
                accessibilityState={{ selected: chosen, disabled: sending }}
                style={({ pressed }) => [
                  styles.button,
                  {
                    borderColor: color,
                    backgroundColor: solid ? color : 'transparent',
                    opacity: pressed || sending ? 0.75 : 1,
                  },
                ]}
              >
                <SymbolView
                  name={REPORT_ICONS[result]}
                  size={18}
                  weight="bold"
                  tintColor={solid ? '#FFFFFF' : color}
                />
                <Text style={[styles.buttonText, { color: solid ? '#FFFFFF' : color }]}>
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
            style={styles.undo}
          >
            <Text style={[styles.link, { color: palette.accent }]}>Angre svaret</Text>
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
  buttons: { flexDirection: 'row', gap: 10, marginTop: 4 },
  undo: { alignSelf: 'flex-start' },
  button: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    borderWidth: 2,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonText: { fontSize: 17, fontWeight: '700' },
  link: { fontSize: 16, fontWeight: '600', paddingVertical: 8 },
  message: { padding: 16, gap: 10 },
  spinner: { marginTop: 48 },
});
