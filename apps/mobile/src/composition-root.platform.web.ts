import type { DevicePlatform } from '@amexbutikker/contracts';
import type { PlatformAdapters } from './composition-root';
import { BrowserLocationProvider } from './location/browser-location.provider';
import type { LocationProvider } from './location/location.ports';
import { LocalStorageKeyValueStorage } from './shared/local-storage-key-value.storage';
import type { KeyValueStorage } from './shared/shared.ports';
import type { RegionMonitor, VisitNotifier } from './visits/visits.ports';

/** The browser: localStorage for the device token, browser geolocation. */
export class CurrentPlatform implements PlatformAdapters {
  public readonly platform: DevicePlatform = 'web';
  public readonly tokenStorage: KeyValueStorage = new LocalStorageKeyValueStorage(
    typeof localStorage === 'undefined' ? undefined : localStorage,
  );
  public readonly location: LocationProvider = new BrowserLocationProvider(
    typeof navigator === 'undefined' ? undefined : navigator.geolocation,
    { maxAgeMs: 5 * 60_000, timeoutMs: 10_000 },
  );
  public readonly regionMonitor: RegionMonitor | null = null;
  public readonly visitNotifier: VisitNotifier | null = null;
  /** Native-only features are hidden on the web, not stubbed. */
  public readonly native = false;
}
