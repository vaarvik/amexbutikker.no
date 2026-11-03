import { z } from 'zod';
import { DevicePlatformSchema } from './devices.model.js';
import type { DevicePlatform } from './devices.model.js';
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
