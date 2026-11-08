import type { PlaceSummaryDto } from '@amexbutikker/contracts';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NearbyState } from '../../places/places.model';
import {
  NO_FILTER,
  PlaceFilterChips,
  isFiltered,
  toFilterQuery,
} from '../../ui/place-filter-chips';
import type { PlaceFilterChoice } from '../../ui/place-filter-chips';
import { PlaceRow } from '../../ui/place-row';
import { useServices } from '../../ui/services';
import { usePalette } from '../../ui/theme';
import { WalletSetupPrompt } from '../../ui/wallet-setup-prompt';

const SEARCH_DELAY_MS = 250;

/** The answer for one query; while the user types, the previous answer stays on screen. */
type SearchResult =
  | { readonly query: string; readonly results: readonly PlaceSummaryDto[] }
  | { readonly query: string; readonly message: string };

export default function Home() {
  const { nearby, places, presenter, visits, widgets } = useServices();
  const palette = usePalette();
  const [query, setQuery] = useState('');
  const [nearbyState, setNearbyState] = useState<NearbyState>({ kind: 'loading' });
  const [search, setSearch] = useState<SearchResult | null>(null);
  const latestSearch = useRef(0);
  const latestNearby = useRef(0);
  const insets = useSafeAreaInsets();
  const [choice, setChoice] = useState<PlaceFilterChoice>(NO_FILTER);
  const filtered = isFiltered(choice);
  const filter = useMemo(() => toFilterQuery(choice), [choice]);

  // Runs on first show, every time the user comes back (e.g. after answering on a place
  // screen) and when the filter changes. Only the newest load may update the list.
  const reload = useCallback(() => {
    const id = ++latestNearby.current;
    void nearby.load(filter, (state) => {
      if (id === latestNearby.current) setNearbyState(state);
    });
  }, [nearby, filter]);
  useFocusEffect(reload);
  const [focusCount, setFocusCount] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setFocusCount((n) => n + 1);
    }, []),
  );

  // A fresh, unfiltered list re-selects the watched places and refreshes the widget.
  const freshResults =
    nearbyState.kind === 'ready' && !nearbyState.fromCache && !filtered
      ? nearbyState.snapshot.results
      : null;
  useEffect(() => {
    if (freshResults !== null) {
      void visits?.refresh(freshResults).catch(() => undefined);
      void widgets.update(freshResults);
    }
  }, [freshResults, visits, widgets]);

  const center = 'snapshot' in nearbyState ? nearbyState.snapshot?.center : undefined;
  const lat = center?.lat;
  const lng = center?.lng;
  const text = query.trim();

  useEffect(() => {
    if (text === '') {
      return;
    }
    const id = ++latestSearch.current;
    const key = `${text}|${JSON.stringify(filter)}`;
    const timer = setTimeout(() => {
      places
        .search({
          q: text,
          ...(lat === undefined || lng === undefined ? {} : { lat, lng }),
          ...filter,
        })
        .then(({ results }) => {
          if (id === latestSearch.current) setSearch({ query: key, results });
        })
        .catch((error: unknown) => {
          if (id === latestSearch.current)
            setSearch({ query: key, message: presenter.error(error) });
        });
    }, SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [text, lat, lng, filter, places, presenter, focusCount]);

  const muted = { color: palette.muted };
  const searching = text !== '';
  // A search is identified by its text and filter, so changing a chip shows the spinner too.
  const searchKey = `${text}|${JSON.stringify(filter)}`;
  const pending = searching && search?.query !== searchKey;
  const results = search !== null && 'results' in search ? search.results : [];
  const nearbyResults = 'snapshot' in nearbyState ? (nearbyState.snapshot?.results ?? []) : [];

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <View style={[styles.hero, { backgroundColor: palette.hero, paddingTop: insets.top + 12 }]}>
        <View style={[styles.column, styles.header]}>
          <Text style={[styles.title, { color: palette.onHero }]} accessibilityRole="header">
            Tar de Amex?
          </Text>
          <View style={[styles.inputWrap, { backgroundColor: palette.card }]}>
            <SymbolView
              name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
              size={17}
              tintColor={palette.muted}
            />
            <TextInput
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              returnKeyType="search"
              clearButtonMode="while-editing"
              placeholder="Søk"
              placeholderTextColor={palette.muted}
              accessibilityLabel="Søk etter sted"
              style={[styles.input, { color: palette.text }]}
            />
          </View>
        </View>
        <View style={[styles.column, styles.chips]}>
          <PlaceFilterChips choice={choice} onChange={setChoice} />
        </View>
      </View>

      {searching ? (
        <FlatList
          data={results}
          keyExtractor={(item) => item.place.id}
          renderItem={({ item }) => <PlaceRow summary={item} />}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          style={styles.column}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            pending && results.length === 0 ? (
              <ActivityIndicator style={styles.spacer} />
            ) : undefined
          }
          ListEmptyComponent={
            pending ? undefined : search !== null && 'message' in search ? (
              <Text style={[styles.message, muted]}>{search.message}</Text>
            ) : (
              <View>
                <Text style={[styles.message, muted]}>
                  {filtered
                    ? `Ingen treff for «${text}» med dette filteret.`
                    : `Ingen treff for «${text}».`}
                </Text>
                <AddPlaceLink />
              </View>
            )
          }
        />
      ) : (
        <FlatList
          data={nearbyResults}
          keyExtractor={(item) => item.place.id}
          renderItem={({ item }) => <PlaceRow summary={item} />}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          style={styles.column}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <>
              <WalletSetupPrompt />
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, muted]}>NÆR DEG</Text>
                {nearbyState.kind === 'ready' && nearbyState.refreshing ? (
                  <ActivityIndicator />
                ) : null}
              </View>
            </>
          }
          ListEmptyComponent={
            <NearbyMessage state={nearbyState} filtered={filtered} onRetry={reload} />
          }
          ListFooterComponent={
            nearbyState.kind === 'failed' || nearbyState.kind === 'no-location' ? (
              nearbyState.snapshot === null ? undefined : (
                <NearbyMessage state={nearbyState} filtered={filtered} onRetry={reload} />
              )
            ) : (
              <AddPlaceLink />
            )
          }
        />
      )}
    </View>
  );
}

function NearbyMessage(props: {
  readonly state: NearbyState;
  readonly filtered: boolean;
  readonly onRetry: () => void;
}) {
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
      return (
        <Text style={[styles.message, muted]}>
          {props.filtered
            ? 'Ingen steder i nærheten passer filteret.'
            : 'Ingen kjente steder i nærheten.'}
        </Text>
      );
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
    <Pressable
      onPress={() => {
        router.push('/add');
      }}
      accessibilityRole="button"
      hitSlop={8}
      style={({ pressed }) => [styles.addLink, { opacity: pressed ? 0.5 : 1 }]}
    >
      <Text style={[styles.link, { color: palette.accent }]}>Legg til sted</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  // Full width on phones; a centred column on desktop browsers.
  column: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  hero: { borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  header: { paddingHorizontal: 20, paddingBottom: 12, gap: 12 },
  // At least the hero's corner radius, so a chip scrolled to the edge never meets the curve.
  chips: { paddingBottom: 28 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bell: { padding: 6 },
  title: { fontSize: 34, fontWeight: '700', letterSpacing: 0.3 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingLeft: 10,
  },
  input: { flex: 1, fontSize: 17, paddingHorizontal: 8, paddingVertical: 9 },
  list: { paddingBottom: 32 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 6,
  },
  sectionTitle: { fontSize: 13, fontWeight: '400', letterSpacing: 0.2 },
  message: { paddingHorizontal: 32, paddingVertical: 16, gap: 10, alignItems: 'flex-start' },
  link: { fontSize: 17 },
  addLink: { paddingHorizontal: 32, paddingVertical: 16, alignSelf: 'flex-start' },
  spacer: { marginTop: 24 },
});
