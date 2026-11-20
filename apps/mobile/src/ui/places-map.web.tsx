import { MAX_AREA_SPAN_DEG } from '@amexbutikker/contracts';
import type { PlaceSummaryDto } from '@amexbutikker/contracts';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import maplibregl from 'maplibre-gl';
import type { GeoJSONSource, MapGeoJSONFeature } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CategoryIcon } from './category-icon';
import { useServices } from './services';
import { StatusBadge } from './status-badge';
import { STATUS_COLORS, usePalette } from './theme';

/** OpenFreeMap: OpenStreetMap vector tiles, free for apps, no key. Muted, so the pins stand out. */
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';
const OSLO: [number, number] = [10.7389, 59.9133];
const FETCH_DELAY_MS = 300;
const PIN_LAYERS = ['clusters', 'unknown', 'answered'];

type Bounds = readonly [west: number, south: number, east: number, north: number];

type AreaState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'too-wide' }
  | { readonly kind: 'ready'; readonly truncated: boolean }
  | { readonly kind: 'failed'; readonly message: string };

/**
 * The Kart tab in the browser, with MapLibre GL: the same tiles, pins, clusters and card as the
 * native map (places-map.tsx). Answered pins carry their answer as text from zoom 15.
 */
export function PlacesMap() {
  const { places, presenter, location } = useServices();
  const palette = usePalette();
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(0);
  const answeredOnlyRef = useRef(true);
  const [results, setResults] = useState<readonly PlaceSummaryDto[]>([]);
  const [area, setArea] = useState<AreaState>({ kind: 'idle' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Hides "Ikke sjekket" on the server, so a busy area never cuts away the answers.
  const [answeredOnly, setAnsweredOnly] = useState(true);
  const [loaded, setLoaded] = useState(false);

  const load = (bounds: Bounds, onlyAnswered: boolean, delayMs = FETCH_DELAY_MS) => {
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
  // The map's listeners are added once; they call the latest `load` through this ref.
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const currentBounds = (): Bounds | null => {
    const bounds = map.current?.getBounds();
    return bounds === undefined
      ? null
      : [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
  };

  useEffect(() => {
    if (container.current === null) return undefined;
    const instance = new maplibregl.Map({
      container: container.current,
      style: MAP_STYLE,
      center: OSLO,
      zoom: 14,
      attributionControl: { compact: true },
    });
    map.current = instance;

    instance.on('load', () => {
      instance.addSource('places', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterRadius: 44,
        clusterMaxZoom: 14,
      });
      addPinLayers(instance);
      setLoaded(true);
      const bounds = currentBounds();
      if (bounds !== null) loadRef.current(bounds, answeredOnlyRef.current, 0);
    });
    instance.on('moveend', () => {
      const bounds = currentBounds();
      if (bounds !== null) loadRef.current(bounds, answeredOnlyRef.current);
    });
    instance.on('click', (event) => {
      const [feature] = instance.queryRenderedFeatures(event.point, { layers: PIN_LAYERS });
      if (feature === undefined) {
        setSelectedId(null);
        return;
      }
      selectPin(instance, feature, setSelectedId);
    });
    for (const layer of PIN_LAYERS) {
      instance.on('mouseenter', layer, () => {
        instance.getCanvas().style.cursor = 'pointer';
      });
      instance.on('mouseleave', layer, () => {
        instance.getCanvas().style.cursor = '';
      });
    }

    // Start where the phone is; the map opens on Oslo until the position is known.
    void location.findCurrent().then((here) => {
      if (here === null || map.current !== instance) return;
      instance.jumpTo({ center: [here.lng, here.lat], zoom: 15 });
      const dot = document.createElement('div');
      dot.style.cssText =
        'width:14px;height:14px;border-radius:50%;background:#2F6FED;border:3px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.2)';
      new maplibregl.Marker({ element: dot }).setLngLat([here.lng, here.lat]).addTo(instance);
    });

    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
      map.current = null;
      instance.remove();
    };
    // Built once per mount; `location` comes from the composition root and does not change.
  }, [location]);

  const features = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: results.flatMap(({ place, status }) =>
        place.kind === 'physical'
          ? [
              {
                type: 'Feature' as const,
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

  useEffect(() => {
    if (!loaded) return;
    map.current?.getSource<GeoJSONSource>('places')?.setData(features);
  }, [features, loaded]);

  const toggleAnswered = () => {
    const next = !answeredOnly;
    answeredOnlyRef.current = next;
    setAnsweredOnly(next);
    setSelectedId(null);
    const bounds = currentBounds();
    if (bounds !== null) load(bounds, next, 0);
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
      <div ref={container} style={{ position: 'absolute', inset: 0 }} />

      <View style={[styles.top, { top: 12 }]} pointerEvents="box-none">
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

/** A cluster zooms in until it splits; a pin selects its place for the card. */
function selectPin(
  instance: maplibregl.Map,
  feature: MapGeoJSONFeature,
  select: (id: string | null) => void,
): void {
  if (feature.geometry.type !== 'Point') return;
  const [lng = 0, lat = 0] = feature.geometry.coordinates;
  const clusterId: unknown = feature.properties.cluster_id;
  if (typeof clusterId === 'number') {
    void instance
      .getSource<GeoJSONSource>('places')
      ?.getClusterExpansionZoom(clusterId)
      .then((zoom) => {
        instance.easeTo({ center: [lng, lat], zoom, duration: 400 });
      });
    return;
  }
  const id: unknown = feature.properties.id;
  select(typeof id === 'string' ? id : null);
}

/** The same layers as the native map: clusters, grey unknowns, coloured answers, labels. */
function addPinLayers(instance: maplibregl.Map): void {
  const single: maplibregl.FilterSpecification = ['!', ['has', 'point_count']];
  instance.addLayer({
    id: 'clusters',
    type: 'circle',
    source: 'places',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': '#161D3A',
      'circle-radius': ['step', ['get', 'point_count'], 14, 20, 18, 100, 24],
      'circle-stroke-color': '#FFFFFF',
      'circle-stroke-width': 2,
    },
  });
  instance.addLayer({
    id: 'cluster-count',
    type: 'symbol',
    source: 'places',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-font': ['Noto Sans Bold'],
      'text-size': 12,
    },
    paint: { 'text-color': '#FFFFFF' },
  });
  instance.addLayer({
    id: 'unknown',
    type: 'circle',
    source: 'places',
    filter: ['all', single, ['==', ['get', 'status'], 'unknown']],
    paint: {
      'circle-color': '#8A929C',
      'circle-radius': 4,
      'circle-stroke-color': '#FFFFFF',
      'circle-stroke-width': 1,
    },
  });
  instance.addLayer({
    id: 'answered',
    type: 'circle',
    source: 'places',
    filter: ['all', single, ['!=', ['get', 'status'], 'unknown']],
    paint: {
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
    },
  });
  instance.addLayer({
    id: 'answered-label',
    type: 'symbol',
    source: 'places',
    minzoom: 15,
    filter: ['all', single, ['!=', ['get', 'status'], 'unknown']],
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['Noto Sans Regular'],
      'text-size': 12,
      'text-offset': [0, 1.3],
      'text-anchor': 'top',
      'text-max-width': 10,
    },
    paint: {
      'text-color': '#16181D',
      'text-halo-color': '#FFFFFF',
      'text-halo-width': 1.5,
    },
  });
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
  notice: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  noticeText: { fontSize: 14, fontWeight: '600' },
  card: {
    position: 'absolute',
    left: 12,
    right: 12,
    // Above MapLibre's attribution line, which a card must not cover.
    bottom: 40,
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
