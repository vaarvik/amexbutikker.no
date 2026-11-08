import { z } from 'zod';
import {
  DeviceAttestationKindSchema,
  DeviceAttestationProofSchema,
  DevicePlatformSchema,
} from './devices.model.js';
import type {
  DeviceAttestationKind,
  DeviceAttestationProof,
  DevicePlatform,
} from './devices.model.js';
import { UserIdSchema } from '../shared/shared.model.js';
import type { UserId } from '../shared/shared.model.js';

// ---------------------------------------------------------------------------
// POST /v1/devices  ->  201 RegisterDeviceResponseDto

export interface RegisterDeviceRequestDto {
  readonly platform: DevicePlatform;
}

export const RegisterDeviceRequestDtoSchema: z.ZodType<RegisterDeviceRequestDto> = z.object({
  platform: DevicePlatformSchema,
});

export interface RegisterDeviceResponseDto {
  readonly userId: UserId;
  /** Send as `Authorization: Bearer <token>` on write endpoints. */
  readonly token: string;
}

export const RegisterDeviceResponseDtoSchema: z.ZodType<RegisterDeviceResponseDto> = z.object({
  userId: UserIdSchema,
  token: z.string().min(1),
});

// ---------------------------------------------------------------------------
// POST /v1/devices/me/challenge  (device token required)  ->  AttestationChallengeResponseDto

export interface AttestationChallengeResponseDto {
  readonly challenge: string;
}

export const AttestationChallengeResponseDtoSchema: z.ZodType<AttestationChallengeResponseDto> =
  z.object({ challenge: z.string().min(1) });

// ---------------------------------------------------------------------------
// POST /v1/devices/me/attestation  (device token required)  ->  AttestDeviceResponseDto

export type AttestDeviceRequestDto = DeviceAttestationProof;
export const AttestDeviceRequestDtoSchema: z.ZodType<AttestDeviceRequestDto> =
  DeviceAttestationProofSchema;

export interface AttestDeviceResponseDto {
  readonly kind: DeviceAttestationKind;
}

export const AttestDeviceResponseDtoSchema: z.ZodType<AttestDeviceResponseDto> = z.object({
  kind: DeviceAttestationKindSchema,
});
