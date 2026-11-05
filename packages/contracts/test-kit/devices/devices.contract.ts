import { describe, expect, it } from 'vitest';
import { ConflictError } from '../../src/index.js';
import type { DeviceWriter } from '../../src/index.js';
import { FixtureHolder } from '../fixture.js';
import type { FixtureFactory } from '../fixture.js';
import { T0, TestData } from '../test-data.js';

export interface DeviceWriterFixture {
  readonly writer: DeviceWriter;
}

/** Behaviour every DeviceWriter must have. */
export function describeDeviceWriterContract(
  name: string,
  factory: FixtureFactory<DeviceWriterFixture>,
): void {
  describe(`${name} satisfies DeviceWriter`, () => {
    const fixture = new FixtureHolder(factory);

    it('registers a device', async () => {
      const userId = new TestData().userId();

      await expect(
        fixture.current.writer.create({ userId, platform: 'ios', createdAt: T0 }),
      ).resolves.toBeUndefined();
    });

    it('throws ConflictError for a user id that is already registered', async () => {
      const userId = new TestData().userId();
      await fixture.current.writer.create({ userId, platform: 'android', createdAt: T0 });

      await expect(
        fixture.current.writer.create({ userId, platform: 'web', createdAt: T0 }),
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });
}
