import { z } from 'zod';
import { UserIdSchema } from '../shared/shared.model.js';
import type { UserId } from '../shared/shared.model.js';

export type DevicePlatform = 'ios' | 'android' | 'web';
export const DEVICE_PLATFORMS = [
  'ios',
  'android',
  'web',
] as const satisfies readonly DevicePlatform[];
export const DevicePlatformSchema: z.ZodType<DevicePlatform> = z.enum(DEVICE_PLATFORMS);

/** A registered anonymous device. Its user id is what device tokens are bound to. */
export interface Device {
  readonly userId: UserId;
  readonly platform: DevicePlatform;
  readonly createdAt: Date;
}

export const DeviceSchema: z.ZodType<Device> = z.object({
  userId: UserIdSchema,
  platform: DevicePlatformSchema,
  createdAt: z.date(),
});

/**
 * How a device showed it is a real install of the app:
 * - `app_attest`: Apple App Attest, a key in the iPhone's Secure Enclave certified by Apple.
 * - `turnstile`: a Cloudflare Turnstile check in the browser.
 */
export type DeviceAttestationKind = 'app_attest' | 'turnstile';
export const DEVICE_ATTESTATION_KINDS = [
  'app_attest',
  'turnstile',
] as const satisfies readonly DeviceAttestationKind[];
export const DeviceAttestationKindSchema: z.ZodType<DeviceAttestationKind> =
  z.enum(DEVICE_ATTESTATION_KINDS);

/** The latest successful attestation of a device. */
export interface DeviceAttestation {
  readonly kind: DeviceAttestationKind;
  readonly attestedAt: Date;
  /** The App Attest key id (base64); null for Turnstile. One key attests one device. */
  readonly keyId: string | null;
}

export const DeviceAttestationSchema: z.ZodType<DeviceAttestation> = z.object({
  kind: DeviceAttestationKindSchema,
  attestedAt: z.date(),
  keyId: z.string().min(1).nullable(),
});

/** The proof a device sends to be attested. Binary values are base64. */
export type DeviceAttestationProof =
  | {
      readonly kind: 'app_attest';
      /** From `DCAppAttestService.generateKey()`. */
      readonly keyId: string;
      /** From `attestKey(keyId, clientDataHash)`, where clientDataHash is SHA-256 of `challenge`. */
      readonly attestationObject: string;
      /** As issued by the API for this device. */
      readonly challenge: string;
    }
  | { readonly kind: 'turnstile'; readonly token: string };

const base64 = z
  .string()
  .min(1)
  .max(20_000)
  .regex(/^[A-Za-z0-9+/]+={0,2}$/, 'must be base64');

export const DeviceAttestationProofSchema: z.ZodType<DeviceAttestationProof> = z.discriminatedUnion(
  'kind',
  [
    z.object({
      kind: z.literal('app_attest'),
      keyId: base64,
      attestationObject: base64,
      challenge: z.string().min(1).max(500),
    }),
    z.object({ kind: z.literal('turnstile'), token: z.string().min(1).max(4096) }),
  ],
);
