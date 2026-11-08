import { describe, expect, it } from 'vitest';
import { ConflictError, NotFoundError } from '../../src/index.js';
import type {
  DeviceWriter,
  Household,
  HouseholdId,
  HouseholdReader,
  HouseholdWriter,
  UserId,
} from '../../src/index.js';
import { FixtureHolder } from '../fixture.js';
import type { FixtureFactory } from '../fixture.js';
import { T0, TestData, daysAfter } from '../test-data.js';

export interface HouseholdRepositoryFixture {
  readonly writer: HouseholdWriter;
  readonly reader: HouseholdReader;
  /** Members are registered devices. */
  readonly devices: DeviceWriter;
}

const HASH = 'a'.repeat(64);

function household(id: HouseholdId): Household {
  return { id, joinTokenHash: HASH, createdAt: T0 };
}

async function member(
  fixture: HouseholdRepositoryFixture,
  householdId: HouseholdId,
  userId: UserId,
  joinedAt = T0,
): Promise<void> {
  await fixture.devices.create({ userId, platform: 'ios', createdAt: T0 });
  await fixture.writer.saveMembership({ householdId, userId, joinedAt, leftAt: null });
}

/** Behaviour every HouseholdWriter must have. */
export function describeHouseholdWriterContract(
  name: string,
  factory: FixtureFactory<HouseholdRepositoryFixture>,
): void {
  describe(`${name} satisfies HouseholdWriter`, () => {
    const fixture = new FixtureHolder(factory);

    it('throws ConflictError for a household id that exists', async () => {
      const id = new TestData().householdId();
      await fixture.current.writer.create(household(id));

      await expect(fixture.current.writer.create(household(id))).rejects.toBeInstanceOf(
        ConflictError,
      );
    });

    it('throws NotFoundError for a membership of a household that does not exist', async () => {
      const data = new TestData();
      const userId = data.userId();
      await fixture.current.devices.create({ userId, platform: 'ios', createdAt: T0 });

      await expect(
        fixture.current.writer.saveMembership({
          householdId: data.householdId(),
          userId,
          joinedAt: T0,
          leftAt: null,
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('appends records with increasing seq, in the order given', async () => {
      const data = new TestData();
      const id = data.householdId();
      const userId = data.userId();
      await fixture.current.writer.create(household(id));
      await member(fixture.current, id, userId);

      const first = await fixture.current.writer.appendRecords([
        { householdId: id, authorId: userId, sealed: 'b25l', createdAt: T0 },
        { householdId: id, authorId: userId, sealed: 'dHdv', createdAt: T0 },
      ]);
      const second = await fixture.current.writer.appendRecords([
        { householdId: id, authorId: userId, sealed: 'dGhyZWU', createdAt: T0 },
      ]);

      expect(first.map((record) => record.sealed)).toEqual(['b25l', 'dHdv']);
      const seqs = [...first, ...second].map((record) => record.seq);
      expect(seqs[0]).toBeGreaterThanOrEqual(1);
      expect([...seqs].sort((a, b) => a - b)).toEqual(seqs);
      expect(new Set(seqs).size).toBe(3);
    });

    it('appends nothing for no records', async () => {
      await expect(fixture.current.writer.appendRecords([])).resolves.toEqual([]);
    });
  });
}

/** Behaviour every HouseholdReader must have. */
export function describeHouseholdReaderContract(
  name: string,
  factory: FixtureFactory<HouseholdRepositoryFixture>,
): void {
  describe(`${name} satisfies HouseholdReader`, () => {
    const fixture = new FixtureHolder(factory);

    it('finds a household by id, and null for an unknown one', async () => {
      const data = new TestData();
      const id = data.householdId();
      await fixture.current.writer.create(household(id));

      await expect(fixture.current.reader.findById(id)).resolves.toEqual(household(id));
      await expect(fixture.current.reader.findById(data.householdId())).resolves.toBeNull();
    });

    it('finds the current membership, and none after leaving', async () => {
      const data = new TestData();
      const id = data.householdId();
      const userId = data.userId();
      await fixture.current.writer.create(household(id));
      await member(fixture.current, id, userId);

      await expect(fixture.current.reader.findMembership(userId)).resolves.toEqual({
        householdId: id,
        userId,
        joinedAt: T0,
        leftAt: null,
      });

      await fixture.current.writer.saveMembership({
        householdId: id,
        userId,
        joinedAt: T0,
        leftAt: daysAfter(T0, 1),
      });
      await expect(fixture.current.reader.findMembership(userId)).resolves.toBeNull();
      await expect(fixture.current.reader.findMembership(data.userId())).resolves.toBeNull();
    });

    it('moves a user to another household', async () => {
      const data = new TestData();
      const [first, second] = [data.householdId(), data.householdId()];
      const userId = data.userId();
      await fixture.current.writer.create(household(first));
      await fixture.current.writer.create(household(second));
      await member(fixture.current, first, userId);

      await fixture.current.writer.saveMembership({
        householdId: second,
        userId,
        joinedAt: daysAfter(T0, 1),
        leftAt: null,
      });

      await expect(fixture.current.reader.findMembership(userId)).resolves.toMatchObject({
        householdId: second,
      });
      await expect(fixture.current.reader.listMembers(first)).resolves.toEqual([]);
    });

    it('lists current members, oldest first', async () => {
      const data = new TestData();
      const id = data.householdId();
      const [late, early, gone] = [data.userId(), data.userId(), data.userId()];
      await fixture.current.writer.create(household(id));
      await member(fixture.current, id, late, daysAfter(T0, 2));
      await member(fixture.current, id, early, daysAfter(T0, 1));
      await member(fixture.current, id, gone, T0);
      await fixture.current.writer.saveMembership({
        householdId: id,
        userId: gone,
        joinedAt: T0,
        leftAt: daysAfter(T0, 3),
      });

      const members = await fixture.current.reader.listMembers(id);

      expect(members.map((m) => m.userId)).toEqual([early, late]);
    });

    it('lists records after a seq, oldest first, up to a limit, for one household only', async () => {
      const data = new TestData();
      const [id, other] = [data.householdId(), data.householdId()];
      const userId = data.userId();
      const otherUser = data.userId();
      await fixture.current.writer.create(household(id));
      await fixture.current.writer.create(household(other));
      await member(fixture.current, id, userId);
      await member(fixture.current, other, otherUser);
      const record = (householdId: HouseholdId, authorId: UserId, sealed: string) => ({
        householdId,
        authorId,
        sealed,
        createdAt: T0,
      });
      const [a] = await fixture.current.writer.appendRecords([record(id, userId, 'YQ')]);
      await fixture.current.writer.appendRecords([record(other, otherUser, 'eA')]);
      await fixture.current.writer.appendRecords([
        record(id, userId, 'Yg'),
        record(id, userId, 'Yw'),
      ]);

      const all = await fixture.current.reader.listRecords(id, 0, 10);
      expect(all.map((r) => r.sealed)).toEqual(['YQ', 'Yg', 'Yw']);
      expect(all[0]).toMatchObject({ householdId: id, authorId: userId, createdAt: T0 });

      const after = await fixture.current.reader.listRecords(id, a?.seq ?? 0, 1);
      expect(after.map((r) => r.sealed)).toEqual(['Yg']);
    });
  });
}
