import type { UserId } from '../shared/shared.model.js';
import type { Device, DeviceAttestation } from './devices.model.js';

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

/** Reads what is known about registered devices. */
export interface DeviceReader {
  /** null when the device has never been attested, or does not exist. */
  findAttestation(userId: UserId): Promise<DeviceAttestation | null>;
}

/** Records registered devices. */
export interface DeviceWriter {
  /** @throws ConflictError when a device with this user id exists. */
  create(device: Device): Promise<void>;
  /**
   * Replaces the device's attestation.
   *
   * @throws NotFoundError when no device has this user id.
   * @throws ConflictError when another device was attested with the same App Attest key.
   */
  saveAttestation(userId: UserId, attestation: DeviceAttestation): Promise<void>;
}

/**
 * One-time-use-ish challenges for App Attest, bound to one device and valid for a few minutes.
 * Stateless: nothing is stored.
 */
export interface AttestationChallengeService {
  issue(userId: UserId): string;
  /** @throws ValidationError when the challenge is malformed, forged, for another device or expired. */
  verify(userId: UserId, challenge: string): void;
}

export interface AppAttestInput {
  readonly keyId: string;
  readonly attestationObject: string;
  /** The challenge the app hashed into its clientDataHash. */
  readonly challenge: string;
}

/** Checks an Apple App Attest attestation object. */
export interface AppAttestValidator {
  /**
   * Checks the certificate chain up to Apple's App Attest root, the nonce, the app id, the key id
   * and the counter, as Apple documents for validating apps that connect to your server.
   *
   * @throws ValidationError when any check fails or App Attest is not configured.
   */
  validate(input: AppAttestInput): Promise<void>;
}

/** Checks a Cloudflare Turnstile token. */
export interface TurnstileValidator {
  /** @throws ValidationError when Cloudflare does not accept the token or Turnstile is not configured. */
  validate(token: string): Promise<void>;
}
