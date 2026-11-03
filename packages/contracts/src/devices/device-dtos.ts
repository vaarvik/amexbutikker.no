import { z } from 'zod';
import { UserIdSchema } from '../shared/ids.js';
import type { UserId } from '../shared/ids.js';
import type { DevicePlatform } from './register-device.js';

// ---------------------------------------------------------------------------
// POST /v1/devices  ->  201 RegisterDeviceResponseDto

export interface RegisterDeviceRequestDto {
  readonly platform: DevicePlatform;
}

export const RegisterDeviceRequestDtoSchema: z.ZodType<RegisterDeviceRequestDto> = z.object({
  platform: z.enum(['ios', 'android', 'web']),
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
