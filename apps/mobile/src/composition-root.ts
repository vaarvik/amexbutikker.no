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

/** What the screens get through `useServices()`. */
export interface AppServices {
  readonly places: PlacesApiClient;
  readonly nearby: NearbyService;
  readonly location: LocationProvider;
  readonly session: DeviceSession;
  readonly presenter: StatusPresenter;
  /** False on the web: native-only features (share intake, visit detection) are hidden there. */
  readonly native: boolean;
}

/** What differs per platform; built by `composition-root.platform(.web).ts`. */
export interface PlatformAdapters {
  readonly platform: DevicePlatform;
  /** Where the device token is kept: SecureStore on phones, localStorage on the web. */
  readonly tokenStorage: KeyValueStorage;
  readonly location: LocationProvider;
  readonly native: boolean;
}

export interface MobileConfig {
  /** API base URL without a trailing slash. */
  readonly apiUrl: string;
}

/** The API on this machine; phones on the LAN need EXPO_PUBLIC_API_URL set to its LAN address. */
const DEFAULT_API_URL = 'http://localhost:3000';

/** The only place in the app that constructs services. */
export class CompositionRoot implements AppServices {
  public readonly places: PlacesApiClient;
  public readonly nearby: NearbyService;
  public readonly location: LocationProvider;
  public readonly session: DeviceSession;
  public readonly presenter: StatusPresenter;
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
    this.nearby = new CachingNearbyService(
      this.places,
      new KeyValueNearbyCache(AsyncStorage, { key: 'nearby-snapshot-v1' }),
      this.location,
      new SystemClock(),
      { radiusM: 1500 },
    );
    this.presenter = new NorwegianStatusPresenter();
  }

  public static fromEnv(): CompositionRoot {
    return new CompositionRoot(
      {
        // Expo inlines EXPO_PUBLIC_* at build time; it must be read as this exact expression.
        apiUrl: CompositionRoot.nonEmpty(process.env.EXPO_PUBLIC_API_URL) ?? DEFAULT_API_URL,
      },
      new CurrentPlatform(),
    );
  }

  private static nonEmpty(value: unknown): string | null {
    return typeof value === 'string' && value !== '' ? value : null;
  }
}
