import type { PlaceSummaryDto } from '@amexbutikker/contracts';
import { Link } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NearbyState } from '../places/places.model';
import { PlaceRow } from '../ui/place-row';
import { useServices } from '../ui/services';
import { usePalette } from '../ui/theme';

const SEARCH_DELAY_MS = 250;

/** The answer for one query; while the user types, the previous answer stays on screen. */
type SearchResult =
  | { readonly query: string; readonly results: readonly PlaceSummaryDto[] }
  | { readonly query: string; readonly message: string };

export default function Home() {
  const { nearby, places, presenter } = useServices();
  const palette = usePalette();
  const [query, setQuery] = useState('');
  const [nearbyState, setNearbyState] = useState<NearbyState>({ kind: 'loading' });
  const [search, setSearch] = useState<SearchResult | null>(null);
  const [reloads, setReloads] = useState(0);
  const latestSearch = useRef(0);

  useEffect(() => {
    void nearby.load(setNearbyState);
  }, [nearby, reloads]);

  const center = 'snapshot' in nearbyState ? nearbyState.snapshot?.center : undefined;
  const lat = center?.lat;
  const lng = center?.lng;
  const text = query.trim();

  useEffect(() => {
    if (text === '') {
      return;
    }
    const id = ++latestSearch.current;
    const timer = setTimeout(() => {
      places
        .search({ q: text, ...(lat === undefined || lng === undefined ? {} : { lat, lng }) })
        .then(({ results }) => {
          if (id === latestSearch.current) setSearch({ query: text, results });
        })
        .catch((error: unknown) => {
          if (id === latestSearch.current)
            setSearch({ query: text, message: presenter.error(error) });
        });
    }, SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [text, lat, lng, places, presenter]);

  const muted = { color: palette.muted };
  const searching = text !== '';
  const pending = searching && search?.query !== text;
  const results = search !== null && 'results' in search ? search.results : [];

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <View style={styles.searchBar}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          autoFocus
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
          placeholder="Søk etter sted eller butikk"
          placeholderTextColor={palette.muted}
          accessibilityLabel="Søk etter sted eller butikk"
          style={[
            styles.input,
            { color: palette.text, backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        />
      </View>

      {searching ? (
        <FlatList
          data={results}
          keyExtractor={(item) => item.place.id}
          renderItem={({ item }) => <PlaceRow summary={item} />}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            pending && results.length === 0 ? (
              <ActivityIndicator style={styles.spacer} />
            ) : undefined
          }
          ListEmptyComponent={
            pending ? undefined : search !== null && 'message' in search ? (
              <Text style={[styles.message, muted]}>{search.message}</Text>
            ) : (
              <View style={styles.message}>
                <Text style={muted}>Ingen treff for «{text}».</Text>
                <AddPlaceLink />
              </View>
            )
          }
        />
      ) : (
        <FlatList
          data={'snapshot' in nearbyState ? (nearbyState.snapshot?.results ?? []) : []}
          keyExtractor={(item) => item.place.id}
          renderItem={({ item }) => <PlaceRow summary={item} />}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Nær deg</Text>
              {nearbyState.kind === 'ready' && nearbyState.refreshing ? (
                <Text style={muted}>Oppdaterer …</Text>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <NearbyMessage
              state={nearbyState}
              onRetry={() => {
                setReloads((n) => n + 1);
              }}
            />
          }
          ListFooterComponent={
            nearbyState.kind === 'failed' || nearbyState.kind === 'no-location' ? (
              nearbyState.snapshot === null ? undefined : (
                <NearbyMessage
                  state={nearbyState}
                  onRetry={() => {
                    setReloads((n) => n + 1);
                  }}
                />
              )
            ) : (
              <View style={styles.message}>
                <AddPlaceLink />
              </View>
            )
          }
        />
      )}
    </View>
  );
}

function NearbyMessage(props: { readonly state: NearbyState; readonly onRetry: () => void }) {
  const { presenter } = useServices();
  const palette = usePalette();
  const muted = { color: palette.muted };
  switch (props.state.kind) {
    case 'loading':
      return (
        <View style={styles.message}>
          <ActivityIndicator />
          <Text style={muted}>Finner steder i nærheten …</Text>
        </View>
      );
    case 'ready':
      return <Text style={[styles.message, muted]}>Ingen kjente steder i nærheten.</Text>;
    case 'no-location':
      return (
        <Text style={[styles.message, muted]}>
          Slå på posisjon for å se steder i nærheten. Du kan fortsatt søke.
        </Text>
      );
    case 'failed':
      return (
        <View style={styles.message}>
          <Text style={muted}>{presenter.error(props.state.error)}</Text>
          <Pressable onPress={props.onRetry} accessibilityRole="button" hitSlop={8}>
            <Text style={[styles.link, { color: palette.accent }]}>Prøv igjen</Text>
          </Pressable>
        </View>
      );
  }
}

function AddPlaceLink() {
  const palette = usePalette();
  return (
    <Link href="/add" style={[styles.link, { color: palette.accent }]} accessibilityRole="button">
      Finner du ikke stedet? Legg det til
    </Link>
  );
}

const styles = StyleSheet.create({
  // Full width on phones; a centred column on desktop browsers.
  screen: { flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center' },
  searchBar: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  input: {
    fontSize: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  sectionTitle: { fontSize: 20, fontWeight: '700' },
  message: { padding: 16, gap: 10, alignItems: 'flex-start' },
  link: { fontSize: 16, fontWeight: '600', paddingVertical: 8 },
  spacer: { marginTop: 24 },
});
