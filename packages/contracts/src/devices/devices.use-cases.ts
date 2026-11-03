import type { UserId } from '../shared/shared.model.js';

export type DevicePlatform = 'ios' | 'android' | 'web';

export interface RegisterDeviceInput {
  readonly platform: DevicePlatform;
  /** Identifies the caller for rate limiting, e.g. a hash of the client IP. Never stored. */
  readonly clientKey: string;
}

export interface RegisterDeviceOutput {
  readonly userId: UserId;
  readonly token: string;
}

/** Creates an anonymous user for a device. */
export interface RegisterDevice {
  /** @throws RateLimitedError when too many devices register from one client. */
  execute(input: RegisterDeviceInput): Promise<RegisterDeviceOutput>;
}
