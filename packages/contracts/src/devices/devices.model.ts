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
