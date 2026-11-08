import { describe, expect, it } from 'vitest';
import { ConflictError, NotFoundError } from '../../src/index.js';
import type { DeviceAttestation, DeviceReader, DeviceWriter } from '../../src/index.js';
import { FixtureHolder } from '../fixture.js';
import type { FixtureFactory } from '../fixture.js';
import { T0, TestData } from '../test-data.js';

export interface DeviceRepositoryFixture {
  readonly writer: DeviceWriter;
  readonly reader: DeviceReader;
}

const appAttest = (keyId: string): DeviceAttestation => ({
  kind: 'app_attest',
  attestedAt: T0,
  keyId,
});

/** Behaviour every DeviceWriter must have. */
export function describeDeviceWriterContract(
  name: string,
  factory: FixtureFactory<DeviceRepositoryFixture>,
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

    it('throws NotFoundError when attesting a device that is not registered', async () => {
      await expect(
        fixture.current.writer.saveAttestation(new TestData().userId(), appAttest('a2V5')),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('throws ConflictError when an App Attest key already attested another device', async () => {
      const data = new TestData();
      const [first, second] = [data.userId(), data.userId()];
      await fixture.current.writer.create({ userId: first, platform: 'ios', createdAt: T0 });
      await fixture.current.writer.create({ userId: second, platform: 'ios', createdAt: T0 });
      await fixture.current.writer.saveAttestation(first, appAttest('c2FtZQ=='));

      await expect(
        fixture.current.writer.saveAttestation(second, appAttest('c2FtZQ==')),
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });
}

/** Behaviour every DeviceReader must have. */
export function describeDeviceReaderContract(
  name: string,
  factory: FixtureFactory<DeviceRepositoryFixture>,
): void {
  describe(`${name} satisfies DeviceReader`, () => {
    const fixture = new FixtureHolder(factory);

    it('finds no attestation for a new device, or an unknown one', async () => {
      const userId = new TestData().userId();
      await fixture.current.writer.create({ userId, platform: 'web', createdAt: T0 });

      await expect(fixture.current.reader.findAttestation(userId)).resolves.toBeNull();
      await expect(
        fixture.current.reader.findAttestation(new TestData().userId()),
      ).resolves.toBeNull();
    });

    it('finds the latest attestation, and lets the same device attest its key again', async () => {
      const userId = new TestData().userId();
      await fixture.current.writer.create({ userId, platform: 'ios', createdAt: T0 });
      await fixture.current.writer.saveAttestation(userId, {
        kind: 'turnstile',
        attestedAt: T0,
        keyId: null,
      });
      await fixture.current.writer.saveAttestation(userId, appAttest('a2V5'));
      await fixture.current.writer.saveAttestation(userId, appAttest('a2V5'));

      await expect(fixture.current.reader.findAttestation(userId)).resolves.toEqual(
        appAttest('a2V5'),
      );
    });

    it('lets several devices pass Turnstile', async () => {
      const data = new TestData();
      const turnstile: DeviceAttestation = { kind: 'turnstile', attestedAt: T0, keyId: null };
      for (const userId of [data.userId(), data.userId()]) {
        await fixture.current.writer.create({ userId, platform: 'web', createdAt: T0 });
        await fixture.current.writer.saveAttestation(userId, turnstile);
        await expect(fixture.current.reader.findAttestation(userId)).resolves.toEqual(turnstile);
      }
    });
  });
}
