import { describe, expect, it } from 'vitest';
import { ConflictError, NotFoundError, PasskeyIdSchema } from '../../src/index.js';
import type { Passkey, PasskeyReader, PasskeyWriter } from '../../src/index.js';
import { FixtureHolder } from '../fixture.js';
import type { FixtureFactory } from '../fixture.js';
import { T0 } from '../test-data.js';

export interface PasskeyRepositoryFixture {
  readonly writer: PasskeyWriter;
  readonly reader: PasskeyReader;
}

let next = 0;

/** A passkey with an id no other test uses. */
function passkey(): Passkey {
  next += 1;
  return {
    id: PasskeyIdSchema.parse(`cGFzc2tleS0${String(next)}_${String(Date.now())}`),
    publicKey: 'pQECAyYgASFYIA',
    counter: 0,
    transports: ['internal', 'hybrid'],
    createdAt: T0,
  };
}

/** Behaviour every PasskeyWriter must have. */
export function describePasskeyWriterContract(
  name: string,
  factory: FixtureFactory<PasskeyRepositoryFixture>,
): void {
  describe(`${name} satisfies PasskeyWriter`, () => {
    const fixture = new FixtureHolder(factory);

    it('stores a passkey', async () => {
      const stored = passkey();
      await fixture.current.writer.create(stored);

      await expect(fixture.current.reader.findById(stored.id)).resolves.toEqual(stored);
    });

    it('throws ConflictError for a passkey that is already stored', async () => {
      const stored = passkey();
      await fixture.current.writer.create(stored);

      await expect(fixture.current.writer.create(stored)).rejects.toBeInstanceOf(ConflictError);
    });

    it('saves a new signature counter', async () => {
      const stored = passkey();
      await fixture.current.writer.create(stored);
      await fixture.current.writer.saveCounter(stored.id, 7);

      await expect(fixture.current.reader.findById(stored.id)).resolves.toEqual({
        ...stored,
        counter: 7,
      });
    });

    it('throws NotFoundError when saving the counter of an unknown passkey', async () => {
      await expect(fixture.current.writer.saveCounter(passkey().id, 1)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });
}

/** Behaviour every PasskeyReader must have. */
export function describePasskeyReaderContract(
  name: string,
  factory: FixtureFactory<PasskeyRepositoryFixture>,
): void {
  describe(`${name} satisfies PasskeyReader`, () => {
    const fixture = new FixtureHolder(factory);

    it('finds nothing for an unknown id', async () => {
      await expect(fixture.current.reader.findById(passkey().id)).resolves.toBeNull();
    });
  });
}
