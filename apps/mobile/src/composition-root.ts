import type { DevicePlatform } from '@amexbutikker/contracts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { DeviceSession } from './devices/devices.ports';
import { FetchDevicesApiClient } from './devices/fetch-devices-api.client';
import { StoredDeviceSession } from './devices/stored-device.session';
import { ExpoLocationProvider } from './location/expo-location.provider';
import type { LocationProvider } from './location/location.ports';
import { CachingNearbyService } from './places/caching-nearby.service';
import { FetchPlacesApiClient } from './places/fetch-places-api.client';
import { KeyValueNearbyCache } from './places/key-value-nearby.cache';
import type { NearbyService, PlacesApiClient } from './places/places.ports';
import { FetchJsonTransport } from './shared/fetch-json.transport';
import { SecureStoreKeyValueStorage } from './shared/secure-store-key-value.storage';
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
}

export interface MobileConfig {
  /** API base URL without a trailing slash. */
  readonly apiUrl: string;
  readonly platform: DevicePlatform;
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

  public constructor(config: MobileConfig) {
    const transport = new FetchJsonTransport((url, init) => fetch(url, init), {
      baseUrl: config.apiUrl.replace(/\/+$/, ''),
      timeoutMs: 8000,
    });
    // SecureStore exists on iOS and Android only; the web keeps the token in localStorage.
    const tokenStorage: KeyValueStorage =
      config.platform === 'web' ? AsyncStorage : new SecureStoreKeyValueStorage(SecureStore);
    this.session = new StoredDeviceSession(new FetchDevicesApiClient(transport), tokenStorage, {
      platform: config.platform,
      key: 'device-token',
    });
    this.places = new FetchPlacesApiClient(transport, this.session);
    this.location = new ExpoLocationProvider(Location, {
      maxLastKnownAgeMs: 5 * 60_000,
      requiredAccuracyM: 200,
      accuracy: Location.Accuracy.Balanced,
    });
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
    return new CompositionRoot({
      // Expo inlines EXPO_PUBLIC_* at build time; it must be read as this exact expression.
      apiUrl: CompositionRoot.nonEmpty(process.env.EXPO_PUBLIC_API_URL) ?? DEFAULT_API_URL,
      platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web',
    });
  }

  private static nonEmpty(value: unknown): string | null {
    return typeof value === 'string' && value !== '' ? value : null;
  }
}
