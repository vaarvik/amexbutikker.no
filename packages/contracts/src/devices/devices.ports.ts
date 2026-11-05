import type { UserId } from '../shared/shared.model.js';
import type { Device } from './devices.model.js';

export interface IssuedDeviceToken {
  readonly token: string;
  readonly userId: UserId;
  readonly issuedAt: Date;
}

/** Issues and verifies the signed tokens that identify anonymous devices. */
export interface DeviceTokenService {
  /** @returns an opaque signed token bound to `userId`. */
  issue(userId: UserId): Promise<IssuedDeviceToken>;

  /**
   * @returns the user the token was issued to.
   * @throws UnauthenticatedError when the token is malformed, has a bad signature or has expired.
   */
  verify(token: string): Promise<UserId>;
}

/** Records registered devices. */
export interface DeviceWriter {
  /** @throws ConflictError when a device with this user id exists. */
  create(device: Device): Promise<void>;
}
