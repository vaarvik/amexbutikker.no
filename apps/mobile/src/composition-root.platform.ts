import type { DevicePlatform } from '@amexbutikker/contracts';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { PlatformAdapters } from './composition-root';
import { ExpoLocationProvider } from './location/expo-location.provider';
import type { LocationProvider } from './location/location.ports';
import { SecureStoreKeyValueStorage } from './shared/secure-store-key-value.storage';
import type { KeyValueStorage } from './shared/shared.ports';

/**
 * iOS and Android. Metro picks `composition-root.platform.web.ts` instead when bundling for
 * the web, so native-only modules never reach the web bundle.
 */
export class CurrentPlatform implements PlatformAdapters {
  public readonly platform: DevicePlatform = Platform.OS === 'ios' ? 'ios' : 'android';
  public readonly tokenStorage: KeyValueStorage = new SecureStoreKeyValueStorage(SecureStore);
  public readonly location: LocationProvider = new ExpoLocationProvider(Location, {
    maxLastKnownAgeMs: 5 * 60_000,
    requiredAccuracyM: 200,
    accuracy: Location.Accuracy.Balanced,
  });
  /** Share intake and visit detection exist only in the native app. */
  public readonly native = true;
}
