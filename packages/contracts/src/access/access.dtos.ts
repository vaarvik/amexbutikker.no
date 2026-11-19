import { z } from 'zod';
import type { PasskeyCredential, PasskeyOptions } from './access.model.js';

// The session itself travels only as an HttpOnly cookie, never in a body.

// ---------------------------------------------------------------------------
// POST /v1/access/registration/options  ->  PasskeyOptionsResponseDto

export interface PasskeyRegistrationOptionsRequestDto {
  readonly inviteCode: string;
}

export const PasskeyRegistrationOptionsRequestDtoSchema: z.ZodType<PasskeyRegistrationOptionsRequestDto> =
  z.object({ inviteCode: z.string().min(1).max(200) });

// POST /v1/access/sign-in/options  ->  PasskeyOptionsResponseDto

export interface PasskeyOptionsResponseDto {
  readonly options: PasskeyOptions;
}

export const PasskeyOptionsResponseDtoSchema: z.ZodType<PasskeyOptionsResponseDto> = z.object({
  options: z.record(z.string(), z.unknown()),
});

// ---------------------------------------------------------------------------
// POST /v1/access/registration, POST /v1/access/sign-in  ->  204 and the session cookie

export interface PasskeyCredentialRequestDto {
  readonly credential: PasskeyCredential;
}

export const PasskeyCredentialRequestDtoSchema: z.ZodType<PasskeyCredentialRequestDto> = z.object({
  credential: z.record(z.string(), z.unknown()),
});

// POST /v1/access/session  ->  204 and a renewed cookie, or 401 when not signed in
