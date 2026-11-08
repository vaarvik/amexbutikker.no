import { MAX_AREA_SPAN_DEG } from '@amexbutikker/contracts';
import type { PlaceSummaryDto } from '@amexbutikker/contracts';
import { Camera, GeoJSONSource, Layer, Map, UserLocation } from '@maplibre/maplibre-react-native';
import type {
  CameraRef,
  GeoJSONSourceRef,
  LngLatBounds,
  PressEventWithFeatures,
} from '@maplibre/maplibre-react-native';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { NativeSyntheticEvent } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryIcon } from './category-icon';
import { useServices } from './services';
import { StatusBadge } from './status-badge';
import { STATUS_COLORS, usePalette } from './theme';

/** OpenFreeMap: OpenStreetMap vector tiles, free for apps, no key. Muted, so the pins stand out. */
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';
const OSLO: [number, number] = [10.7389, 59.9133];
const FETCH_DELAY_MS = 300;

type AreaState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'too-wide' }
  | { readonly kind: 'ready'; readonly truncated: boolean }
  | { readonly kind: 'failed'; readonly message: string };

/**
 * The Kart tab: places in the visible area as pins coloured by status, grouped into numbered
 * clusters when zoomed out. Every answered pin carries its answer as text from zoom 15, so the
 * map never relies on colour alone; tapping a pin opens a card with the answer.
 */
export function PlacesMap() {
  const { places, presenter, location } = useServices();
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const camera = useRef<CameraRef>(null);
  const source = useRef<GeoJSONSourceRef>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(0);
  const lastBounds = useRef<LngLatBounds | null>(null);
  const [results, setResults] = useState<readonly PlaceSummaryDto[]>([]);
  const [area, setArea] = useState<AreaState>({ kind: 'idle' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Hides "Ikke sjekket" on the server, so a busy area never cuts away the answers.
  const [answeredOnly, setAnsweredOnly] = useState(true);

  // Start where the phone is; the map opens on Oslo until the position is known.
  useEffect(() => {
    void location.findCurrent().then((here) => {
      if (here !== null) {
        camera.current?.jumpTo({ center: [here.lng, here.lat], zoom: 15 });
      }
    });
  }, [location]);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const load = (bounds: LngLatBounds, onlyAnswered: boolean, delayMs = FETCH_DELAY_MS) => {
    lastBounds.current = bounds;
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const [west, south, east, north] = bounds;
      if (north - south > MAX_AREA_SPAN_DEG || east - west > MAX_AREA_SPAN_DEG) {
        setArea({ kind: 'too-wide' });
        return;
      }
      const id = ++latest.current;
      places
        .listInArea({ south, west, north, east, answeredOnly: onlyAnswered })
        .then((response) => {
          if (id !== latest.current) return;
          setResults(response.results);
          setArea({ kind: 'ready', truncated: response.truncated });
        })
        .catch((error: unknown) => {
          if (id === latest.current) setArea({ kind: 'failed', message: presenter.error(error) });
        });
    }, delayMs);
  };

  const toggleAnswered = () => {
    const next = !answeredOnly;
    setAnsweredOnly(next);
    setSelectedId(null);
    if (lastBounds.current !== null) load(lastBounds.current, next, 0);
  };

  const features = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: results.flatMap(({ place, status }) =>
        place.kind === 'physical'
          ? [
              {
                type: 'Feature' as const,
                id: place.id,
                geometry: {
                  type: 'Point' as const,
                  coordinates: [place.location.lng, place.location.lat],
                },
                properties: {
                  id: place.id,
                  status: status.status,
                  label: `${place.name} · ${presenter.status(status.status).answer}`,
                },
              },
            ]
          : [],
      ),
    }),
    [results, presenter],
  );

  const onPinPress = (event: NativeSyntheticEvent<PressEventWithFeatures>) => {
    event.stopPropagation();
    const [feature] = event.nativeEvent.features;
    if (feature?.geometry.type !== 'Point') return;
    const [lng = 0, lat = 0] = feature.geometry.coordinates;
    const clusterId: unknown = feature.properties?.cluster_id;
    if (typeof clusterId === 'number') {
      void source.current?.getClusterExpansionZoom(clusterId).then((zoom) => {
        camera.current?.easeTo({ center: [lng, lat], zoom, duration: 400 });
      });
      return;
    }
    const id: unknown = feature.properties?.id;
    setSelectedId(typeof id === 'string' ? id : null);
  };

  const selected = results.find((result) => result.place.id === selectedId) ?? null;
  const notice =
    area.kind === 'too-wide'
      ? 'Zoom inn for å se steder'
      : area.kind === 'failed'
        ? area.message
        : area.kind === 'ready' && area.truncated
          ? answeredOnly
            ? 'Viser svarene nærmest midten. Zoom inn for flere.'
            : 'Viser stedene nærmest midten. Zoom inn for flere.'
          : null;

  return (
    <View style={styles.screen}>
      <Map
        style={styles.screen}
        mapStyle={MAP_STYLE}
        logo={false}
        attributionPosition={{ bottom: 8, left: 8 }}
        compass={false}
        onRegionDidChange={(event) => {
          load(event.nativeEvent.bounds, answeredOnly);
        }}
        onPress={() => {
          setSelectedId(null);
        }}
      >
        <Camera ref={camera} initialViewState={{ center: OSLO, zoom: 14 }} />
        <UserLocation />
        <GeoJSONSource
          id="places"
          ref={source}
          data={features}
          cluster
          clusterRadius={44}
          clusterMaxZoom={14}
          onPress={onPinPress}
        >
          <Layer
            id="clusters"
            type="circle"
            filter={['has', 'point_count']}
            paint={{
              'circle-color': '#161D3A',
              'circle-radius': ['step', ['get', 'point_count'], 14, 20, 18, 100, 24],
              'circle-stroke-color': '#FFFFFF',
              'circle-stroke-width': 2,
            }}
          />
          <Layer
            id="cluster-count"
            type="symbol"
            filter={['has', 'point_count']}
            layout={{
              'text-field': ['get', 'point_count_abbreviated'],
              'text-font': ['Noto Sans Bold'],
              'text-size': 12,
            }}
            paint={{ 'text-color': '#FFFFFF' }}
          />
          <Layer
            id="unknown"
            type="circle"
            filter={['all', ['!', ['has', 'point_count']], ['==', ['get', 'status'], 'unknown']]}
            paint={{
              'circle-color': '#8A929C',
              'circle-radius': 4,
              'circle-stroke-color': '#FFFFFF',
              'circle-stroke-width': 1,
            }}
          />
          <Layer
            id="answered"
            type="circle"
            filter={['all', ['!', ['has', 'point_count']], ['!=', ['get', 'status'], 'unknown']]}
            paint={{
              // Confirmed answers are filled; likely answers are white with a thick ring.
              'circle-color': [
                'match',
                ['get', 'status'],
                'accepted',
                STATUS_COLORS.accepted,
                'rejected',
                STATUS_COLORS.rejected,
                'mixed',
                STATUS_COLORS.mixed,
                '#FFFFFF',
              ],
              'circle-radius': 8,
              'circle-stroke-color': [
                'match',
                ['get', 'status'],
                'likely_accepted',
                STATUS_COLORS.likely_accepted,
                'likely_rejected',
                STATUS_COLORS.likely_rejected,
                '#FFFFFF',
              ],
              'circle-stroke-width': [
                'match',
                ['get', 'status'],
                ['likely_accepted', 'likely_rejected'],
                3,
                2,
              ],
            }}
          />
          <Layer
            id="answered-label"
            type="symbol"
            minzoom={15}
            filter={['all', ['!', ['has', 'point_count']], ['!=', ['get', 'status'], 'unknown']]}
            layout={{
              'text-field': ['get', 'label'],
              'text-font': ['Noto Sans Regular'],
              'text-size': 12,
              'text-offset': [0, 1.3],
              'text-anchor': 'top',
              'text-max-width': 10,
            }}
            paint={{
              'text-color': '#16181D',
              'text-halo-color': '#FFFFFF',
              'text-halo-width': 1.5,
            }}
          />
        </GeoJSONSource>
      </Map>

      <View style={[styles.top, { top: insets.top + 12 }]} pointerEvents="box-none">
        <Pressable
          onPress={toggleAnswered}
          accessibilityRole="switch"
          accessibilityState={{ checked: answeredOnly }}
          accessibilityLabel="Bare steder med svar"
          style={({ pressed }) => [
            styles.filter,
            {
              backgroundColor: answeredOnly ? palette.hero : palette.card,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <SymbolView
            name={{
              ios: answeredOnly ? 'checkmark.circle.fill' : 'circle',
              android: answeredOnly ? 'check_circle' : 'radio_button_unchecked',
              web: answeredOnly ? 'check_circle' : 'radio_button_unchecked',
            }}
            size={16}
            tintColor={answeredOnly ? palette.onHero : palette.muted}
          />
          <Text
            style={[styles.filterText, { color: answeredOnly ? palette.onHero : palette.text }]}
          >
            Bare steder med svar
          </Text>
        </Pressable>
        {notice === null ? null : (
          <View style={[styles.notice, { backgroundColor: palette.hero }]} pointerEvents="none">
            <Text style={[styles.noticeText, { color: palette.onHero }]}>{notice}</Text>
          </View>
        )}
      </View>

      {selected === null ? null : (
        <Pressable
          onPress={() => {
            router.push({ pathname: '/place/[id]', params: { id: selected.place.id } });
          }}
          accessibilityRole="link"
          accessibilityLabel={`${selected.place.name}, ${presenter.status(selected.status.status).answer}`}
          style={({ pressed }) => [
            styles.card,
            { backgroundColor: palette.card, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <CategoryIcon category={selected.place.category} />
          <View style={styles.cardText}>
            <Text style={[styles.cardName, { color: palette.text }]} numberOfLines={1}>
              {selected.place.name}
            </Text>
            <Text style={{ color: palette.muted }} numberOfLines={1}>
              {[presenter.category(selected.place.category), presenter.address(selected.place)]
                .filter((part) => part !== null)
                .join(' · ')}
            </Text>
          </View>
          <StatusBadge status={selected.status.status} />
          <SymbolView
            name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
            size={14}
            tintColor={palette.muted}
          />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 8 },
  filter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  filterText: { fontSize: 14, fontWeight: '600' },
  notice: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  noticeText: { fontSize: 14, fontWeight: '600' },
  card: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  cardText: { flex: 1, gap: 2 },
  cardName: { fontSize: 17, fontWeight: '700' },
});
