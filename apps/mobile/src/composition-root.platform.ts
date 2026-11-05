import type { DevicePlatform } from '@amexbutikker/contracts';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { PlatformAdapters } from './composition-root';
import { ExpoLocationProvider } from './location/expo-location.provider';
import type { LocationProvider } from './location/location.ports';
import { SecureStoreKeyValueStorage } from './shared/secure-store-key-value.storage';
import type { KeyValueStorage } from './shared/shared.ports';
import { ExpoGeofenceRegionMonitor } from './visits/expo-geofence-region.monitor';
import { ExpoVisitNotifier } from './visits/expo-visit.notifier';
import type { RegionMonitor, VisitNotifier } from './visits/visits.ports';

/** The expo-task-manager task that receives geofence events; defined in composition-root.tasks.ts. */
export const VISIT_TASK = 'visit-geofence';

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
  public readonly regionMonitor: RegionMonitor = new ExpoGeofenceRegionMonitor(Location, {
    taskName: VISIT_TASK,
  });
  public readonly visitNotifier: VisitNotifier = new ExpoVisitNotifier(Notifications, {
    askCategory: 'visit-ask',
  });
  /** Share intake and visit detection exist only in the native app. */
  public readonly native = true;
}
