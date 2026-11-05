import type { MatchReason, MatchSharedResponseDto } from '@amexbutikker/contracts';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PlaceRow } from '../ui/place-row';
import { useServices } from '../ui/services';
import { usePalette } from '../ui/theme';

type MatchState =
  | { readonly kind: 'matching' }
  | { readonly kind: 'done'; readonly match: MatchSharedResponseDto }
  | { readonly kind: 'failed'; readonly message: string };

/** Where a share from a maps app lands: opens the place, or lets the user pick. */
export default function SharedPlace() {
  const { text } = useLocalSearchParams<{ text?: string }>();
  const { places, presenter } = useServices();
  const palette = usePalette();
  const [state, setState] = useState<MatchState>({ kind: 'matching' });

  useEffect(() => {
    if (text === undefined || text === '') {
      return;
    }
    places
      .matchShared(text)
      .then((match) => {
        if (match.decision.type === 'open') {
          router.replace({ pathname: '/place/[id]', params: { id: match.decision.placeId } });
        } else {
          setState({ kind: 'done', match });
        }
      })
      .catch((error: unknown) => {
        setState({ kind: 'failed', message: presenter.error(error) });
      });
  }, [text, places, presenter]);

  const muted = { color: palette.muted };
  if (text === undefined || text === '') {
    return <Text style={[styles.message, muted]}>Ingenting ble delt.</Text>;
  }
  if (state.kind === 'matching') {
    return (
      <View style={styles.message}>
        <ActivityIndicator />
        <Text style={muted}>Ser etter stedet …</Text>
      </View>
    );
  }
  if (state.kind === 'failed') {
    return <Text style={[styles.message, muted]}>{state.message}</Text>;
  }

  const { candidates, parsed } = state.match;
  const sharedName = parsed.name ?? 'stedet';
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: palette.text }]}>
        {candidates.length === 0 ? `Fant ikke ${sharedName}` : `Mente du ${sharedName}?`}
      </Text>
      {candidates.length === 0 ? (
        <Text style={muted}>
          Stedet er ikke registrert ennå, eller delingen inneholdt bare en lenke vi ikke kan lese.
        </Text>
      ) : null}
      <View>
        {candidates.map((candidate) => (
          <PlaceRow
            key={candidate.place.id}
            summary={{
              place: candidate.place,
              status: candidate.status,
              distanceM:
                candidate.reasons.find(
                  (reason): reason is Extract<MatchReason, { kind: 'distance' }> =>
                    reason.kind === 'distance',
                )?.distanceM ?? null,
            }}
          />
        ))}
      </View>
      <Link
        href={{ pathname: '/add', params: parsed.name === null ? {} : { name: parsed.name } }}
        style={[styles.link, { color: palette.accent }]}
        accessibilityRole="button"
      >
        {candidates.length === 0 ? 'Legg det til' : 'Ingen av disse – legg det til'}
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, maxWidth: 640, width: '100%', alignSelf: 'center' },
  title: { fontSize: 22, fontWeight: '800' },
  message: { padding: 16, gap: 10 },
  link: { fontSize: 16, fontWeight: '600', paddingVertical: 12 },
});
