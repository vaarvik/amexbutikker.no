import type { DevicePlatform } from '@amexbutikker/contracts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CurrentPlatform } from './composition-root.platform';
import type { DeviceSession } from './devices/devices.ports';
import { FetchDevicesApiClient } from './devices/fetch-devices-api.client';
import { StoredDeviceSession } from './devices/stored-device.session';
import type { LocationProvider } from './location/location.ports';
import { CachingNearbyService } from './places/caching-nearby.service';
import { FetchPlacesApiClient } from './places/fetch-places-api.client';
import { KeyValueNearbyCache } from './places/key-value-nearby.cache';
import type { NearbyService, PlacesApiClient } from './places/places.ports';
import { FetchJsonTransport } from './shared/fetch-json.transport';
import type { KeyValueStorage } from './shared/shared.ports';
import { SystemClock } from './shared/system.clock';
import { NorwegianStatusPresenter } from './status/norwegian-status.presenter';
import type { StatusPresenter } from './status/status.ports';
import { CategoryDwellVisitCandidateRanker } from './visits/category-dwell-visit-candidate.ranker';
import { DwellVisitPromptDecider } from './visits/dwell-visit-prompt.decider';
import { GeofenceVisitService } from './visits/geofence-visit.service';
import { KeyValueVisitStateStorage } from './visits/key-value-visit-state.storage';
import { NearestVisitRegionSelector } from './visits/nearest-visit-region.selector';
import type { RegionMonitor, VisitNotifier, VisitService } from './visits/visits.ports';

/** What the screens get through `useServices()`. */
export interface AppServices {
  readonly places: PlacesApiClient;
  readonly nearby: NearbyService;
  readonly location: LocationProvider;
  readonly session: DeviceSession;
  readonly presenter: StatusPresenter;
  /** Visit detection; null on the web. */
  readonly visits: VisitService | null;
  /** False on the web: native-only features (share intake, visit detection) are hidden there. */
  readonly native: boolean;
}

/** What differs per platform; built by `composition-root.platform(.web).ts`. */
export interface PlatformAdapters {
  readonly platform: DevicePlatform;
  /** Where the device token is kept: SecureStore on phones, localStorage on the web. */
  readonly tokenStorage: KeyValueStorage;
  readonly location: LocationProvider;
  /** OS geofencing and local notifications; null on the web. */
  readonly regionMonitor: RegionMonitor | null;
  readonly visitNotifier: VisitNotifier | null;
  readonly native: boolean;
}

export interface MobileConfig {
  /** API base URL without a trailing slash. */
  readonly apiUrl: string;
  /** How long the phone must be inside a place before leaving it triggers a question. */
  readonly visitMinDwellMs: number;
}

/** The API on this machine; phones on the LAN need EXPO_PUBLIC_API_URL set to its LAN address. */
const DEFAULT_API_URL = 'http://localhost:3000';
const DEFAULT_VISIT_MIN_DWELL_S = 180;
const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** The only place in the app that constructs services. */
export class CompositionRoot implements AppServices {
  public readonly places: PlacesApiClient;
  public readonly nearby: NearbyService;
  public readonly location: LocationProvider;
  public readonly session: DeviceSession;
  public readonly presenter: StatusPresenter;
  public readonly visits: VisitService | null;
  public readonly native: boolean;

  public constructor(config: MobileConfig, adapters: PlatformAdapters) {
    const transport = new FetchJsonTransport((url, init) => fetch(url, init), {
      baseUrl: config.apiUrl.replace(/\/+$/, ''),
      timeoutMs: 8000,
    });
    this.native = adapters.native;
    this.session = new StoredDeviceSession(
      new FetchDevicesApiClient(transport),
      adapters.tokenStorage,
      {
        platform: adapters.platform,
        key: 'device-token',
      },
    );
    this.places = new FetchPlacesApiClient(transport, this.session);
    this.location = adapters.location;
    const clock = new SystemClock();
    this.nearby = new CachingNearbyService(
      this.places,
      new KeyValueNearbyCache(AsyncStorage, { key: 'nearby-snapshot-v1' }),
      this.location,
      clock,
      { radiusM: 1500 },
    );
    this.presenter = new NorwegianStatusPresenter();
    this.visits =
      adapters.regionMonitor === null || adapters.visitNotifier === null
        ? null
        : new GeofenceVisitService(
            adapters.regionMonitor,
            adapters.visitNotifier,
            new NearestVisitRegionSelector({ maxRegions: 18, radiusM: 75 }),
            new DwellVisitPromptDecider(
              new CategoryDwellVisitCandidateRanker({
                dwellRanges: {
                  shop: { minMs: 1 * MINUTE_MS, maxMs: 30 * MINUTE_MS },
                  cafe: { minMs: 5 * MINUTE_MS, maxMs: 60 * MINUTE_MS },
                  fast_food: { minMs: 5 * MINUTE_MS, maxMs: 40 * MINUTE_MS },
                  restaurant: { minMs: 30 * MINUTE_MS, maxMs: 150 * MINUTE_MS },
                  bar: { minMs: 20 * MINUTE_MS, maxMs: 180 * MINUTE_MS },
                  pub: { minMs: 20 * MINUTE_MS, maxMs: 180 * MINUTE_MS },
                  hotel: { minMs: 10 * MINUTE_MS, maxMs: 600 * MINUTE_MS },
                  online_shop: { minMs: 1 * MINUTE_MS, maxMs: 30 * MINUTE_MS },
                  other: { minMs: 2 * MINUTE_MS, maxMs: 60 * MINUTE_MS },
                },
                timeWeight: 0.6,
                categoryWeight: 0.4,
              }),
              {
                minDwellMs: config.visitMinDwellMs,
                askCooldownMs: 30 * DAY_MS,
                minGapBetweenAsksMs: 10 * MINUTE_MS,
                maxAsksPerDay: 3,
                announceCooldownMs: DAY_MS,
                minLead: 0.15,
                maxCandidates: 5,
              },
            ),
            // v2: visits are tracked as stays across overlapping fences.
            new KeyValueVisitStateStorage(AsyncStorage, { key: 'visit-state-v2' }),
            clock,
          );
  }

  public static fromEnv(): CompositionRoot {
    return new CompositionRoot(
      {
        // Expo inlines EXPO_PUBLIC_* at build time; it must be read as this exact expression.
        apiUrl: CompositionRoot.nonEmpty(process.env.EXPO_PUBLIC_API_URL) ?? DEFAULT_API_URL,
        // Lower it (e.g. 20) to try visit detection in the simulator without waiting minutes.
        visitMinDwellMs:
          Number(
            CompositionRoot.nonEmpty(process.env.EXPO_PUBLIC_VISIT_MIN_DWELL_SECONDS) ??
              DEFAULT_VISIT_MIN_DWELL_S,
          ) * 1000,
      },
      new CurrentPlatform(),
    );
  }

  private static nonEmpty(value: unknown): string | null {
    return typeof value === 'string' && value !== '' ? value : null;
  }
}
