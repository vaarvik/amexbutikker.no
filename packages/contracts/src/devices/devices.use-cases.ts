import type { UserId } from '../shared/shared.model.js';
import type {
  DeviceAttestationKind,
  DeviceAttestationProof,
  DevicePlatform,
} from './devices.model.js';

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

export interface IssueAttestationChallengeInput {
  readonly userId: UserId;
}

export interface IssueAttestationChallengeOutput {
  readonly challenge: string;
}

/** A challenge for the device to attest against (App Attest). */
export interface IssueAttestationChallenge {
  execute(input: IssueAttestationChallengeInput): Promise<IssueAttestationChallengeOutput>;
}

export interface AttestDeviceInput {
  readonly userId: UserId;
  readonly proof: DeviceAttestationProof;
}

export interface AttestDeviceOutput {
  readonly kind: DeviceAttestationKind;
}

/**
 * A device shows it is a real install of the app. Attested devices' answers count fully;
 * others count less (see ReportEvidencePolicy).
 */
export interface AttestDevice {
  /**
   * @throws ValidationError when the proof does not check out.
   * @throws NotFoundError when the device is not registered.
   * @throws ConflictError when the App Attest key already attested another device.
   * @throws RateLimitedError when the device tries too often.
   */
  execute(input: AttestDeviceInput): Promise<AttestDeviceOutput>;
}
