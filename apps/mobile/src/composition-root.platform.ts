import type { DevicePlatform } from '@amexbutikker/contracts';
import { requireOptionalNativeModule } from 'expo';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { PlatformAdapters } from './composition-root';
import type { AppAttestModule } from './devices/devices.ports';
import { ExpoLocationProvider } from './location/expo-location.provider';
import type { LocationProvider } from './location/location.ports';
import { SecureStoreKeyValueStorage } from './shared/secure-store-key-value.storage';
import type { KeyValueStorage, RandomBytesModule } from './shared/shared.ports';
import { ExpoGeofenceRegionMonitor } from './visits/expo-geofence-region.monitor';
import { ExpoVisitNotifier } from './visits/expo-visit.notifier';
import type { RegionMonitor, VisitNotifier } from './visits/visits.ports';
import { nearbyWidget } from './ui/nearby-widget';
import { ExpoNearbyWidgetWriter } from './widgets/expo-nearby-widget.writer';
import { NullNearbyWidgetWriter } from './widgets/null-nearby-widget.writer';
import type { NearbyWidgetWriter } from './widgets/widgets.ports';

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
  /** iOS has the widget; Metro picks `nearby-widget.ios.tsx` there and the stand-in elsewhere. */
  public readonly widgetWriter: NearbyWidgetWriter =
    nearbyWidget === null ? new NullNearbyWidgetWriter() : new ExpoNearbyWidgetWriter(nearbyWidget);
  /**
   * The app's own module (modules/app-attest). Null on Android, in Expo Go and in builds made
   * before the module existed.
   */
  public readonly appAttest: AppAttestModule | null =
    Platform.OS === 'ios' ? requireOptionalNativeModule<AppAttestModule>('AppAttest') : null;
  /**
   * Hermes has no `crypto.getRandomValues`; expo-crypto's native module reads the OS's secure
   * random source. Loaded optionally so builds made before it still start (households then fail
   * with an error instead of the whole app).
   */
  public readonly randomBytes: RandomBytesModule = CurrentPlatform.randomBytesModule();
  /** Share intake and visit detection exist only in the native app. */
  public readonly native = true;

  private static randomBytesModule(): RandomBytesModule {
    const native = requireOptionalNativeModule<{ getRandomValues(bytes: Uint8Array): void }>(
      'ExpoCrypto',
    );
    return {
      getRandomBytes: (count) => {
        if (native === null) {
          throw new Error('This build has no secure random source (expo-crypto). Build it again.');
        }
        const bytes = new Uint8Array(count);
        native.getRandomValues(bytes);
        return bytes;
      },
    };
  }
}
