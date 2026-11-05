import type { DevicePlatform, RegisterDeviceResponseDto } from '@amexbutikker/contracts';

/** `POST /v1/devices`. */
export interface DevicesApiClient {
  register(platform: DevicePlatform): Promise<RegisterDeviceResponseDto>;
}

/** The anonymous device identity the app reports with. */
export interface DeviceSession {
  /** The stored token, or null before the device has registered. Never calls the API. */
  findToken(): Promise<string | null>;
  /** The token, registering the device on first use. Concurrent calls register once. */
  getToken(): Promise<string>;
  /** Forgets a token the API rejected, so the next `getToken` registers again. */
  reset(): Promise<void>;
}
