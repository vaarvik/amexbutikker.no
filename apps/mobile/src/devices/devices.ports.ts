import type {
  AttestDeviceRequestDto,
  AttestDeviceResponseDto,
  DevicePlatform,
  RegisterDeviceResponseDto,
} from '@amexbutikker/contracts';

/** The devices endpoints of the API. */
export interface DevicesApiClient {
  /** `POST /v1/devices`. */
  register(platform: DevicePlatform): Promise<RegisterDeviceResponseDto>;
  /** `POST /v1/devices/me/challenge`: a challenge for App Attest. */
  challenge(token: string): Promise<string>;
  /** `POST /v1/devices/me/attestation`. */
  attest(token: string, proof: AttestDeviceRequestDto): Promise<AttestDeviceResponseDto>;
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

/**
 * The app's own native module (`modules/app-attest`, Swift over DCAppAttestService). Absent in
 * builds made before it, in Expo Go and on Android.
 */
export interface AppAttestModule {
  /** False in the simulator and on devices without the Secure Enclave. */
  isSupported(): boolean;
  /** @returns the new key's id, base64. */
  generateKey(): Promise<string>;
  /** @returns the attestation object, base64; the client data hash is SHA-256 of `challenge`. */
  attestKey(keyId: string, challenge: string): Promise<string>;
}

/**
 * Proves this install is real (Phase 16), once per device token, so its answers count in full.
 * Nothing here throws: without attestation the app works, and answers count less.
 */
export interface DeviceAttestationService {
  /** Whether the current device token has been attested. */
  isAttested(): Promise<boolean>;
  /** iOS: attests with App Attest when the phone supports it and it has not been done. */
  attestWithAppAttest(): Promise<boolean>;
  /** Web: attests with a token from the Turnstile widget. */
  attestWithTurnstile(token: string): Promise<boolean>;
}
