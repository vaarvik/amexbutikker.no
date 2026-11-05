import type { GeoPoint } from '@amexbutikker/contracts';

/** Where the phone is. Foreground only: the app never asks for background location. */
export interface LocationProvider {
  /** The current position, or null when permission is denied or no fix is available. */
  findCurrent(): Promise<GeoPoint | null>;
}

interface ExpoLocationObject {
  readonly coords: { readonly latitude: number; readonly longitude: number };
}

/** The part of expo-location the app uses; the composition root passes the module itself. */
export interface ExpoLocationModule {
  requestForegroundPermissionsAsync(): Promise<{ readonly granted: boolean }>;
  getLastKnownPositionAsync(options: {
    readonly maxAge: number;
    readonly requiredAccuracy: number;
  }): Promise<ExpoLocationObject | null>;
  getCurrentPositionAsync(options: { readonly accuracy: number }): Promise<ExpoLocationObject>;
}

/** The part of the browser's `navigator.geolocation` the app uses. */
export interface BrowserGeolocation {
  getCurrentPosition(
    onSuccess: (position: {
      readonly coords: { readonly latitude: number; readonly longitude: number };
    }) => void,
    onError: (error: unknown) => void,
    options: {
      readonly maximumAge: number;
      readonly timeout: number;
      readonly enableHighAccuracy: boolean;
    },
  ): void;
}
