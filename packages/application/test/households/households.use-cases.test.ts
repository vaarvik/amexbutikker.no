import {
  AppendHouseholdRecordsUseCase,
  CreateHouseholdUseCase,
  GetMyHouseholdUseCase,
  JoinHouseholdUseCase,
  LeaveHouseholdUseCase,
  ListHouseholdRecordsUseCase,
} from '@amexbutikker/application';
import {
  ConflictError,
  HOUSEHOLD_MAX_MEMBERS,
  NotFoundError,
  RateLimitedError,
  ValidationError,
} from '@amexbutikker/contracts';
import type {
  ChainId,
  Clock,
  EvidenceId,
  HouseholdId,
  IdGenerator,
  ImportRunId,
  JoinTokenHasher,
  PlaceId,
  UserId,
} from '@amexbutikker/contracts';
import { TestData } from '@amexbutikker/contracts/test-kit';
import {
  EmptyInMemoryTablesFactory,
  InMemoryDeviceRepository,
  InMemoryHouseholdRepository,
  InMemoryRateLimiter,
} from '@amexbutikker/in-memory';
import { describe, expect, it } from 'vitest';

const T0 = new Date('2026-11-08T12:00:00.000Z');
const TOKEN = 'j'.repeat(43);

class FixedClock implements Clock {
  public now(): Date {
    return T0;
  }
}

class PrefixHasher implements JoinTokenHasher {
  public hash(joinToken: string): string {
    return `h:${joinToken}`;
  }
}

class TestIds implements IdGenerator {
  private readonly data = new TestData();

  public placeId(): PlaceId {
    return this.data.placeId();
  }

  public chainId(): ChainId {
    return this.data.chainId();
  }

  public userId(): UserId {
    return this.data.userId();
  }

  public evidenceId(): EvidenceId {
    return this.data.evidenceId();
  }

  public importRunId(): ImportRunId {
    return this.data.importRunId();
  }

  public householdId(): HouseholdId {
    return this.data.householdId();
  }
}

function setup(limit = 100) {
  const tables = new EmptyInMemoryTablesFactory().create();
  const households = new InMemoryHouseholdRepository(tables);
  const devices = new InMemoryDeviceRepository(tables);
  const clock = new FixedClock();
  const limiter = new InMemoryRateLimiter(
    {
      create_household: { limit, windowSeconds: 3600 },
      join_household: { limit, windowSeconds: 3600 },
      append_household_records: { limit, windowSeconds: 3600 },
    },
    clock,
  );
  const hasher = new PrefixHasher();
  const data = new TestData();
  const device = async (): Promise<UserId> => {
    const userId = data.userId();
    await devices.create({ userId, platform: 'ios', createdAt: T0 });
    return userId;
  };
  return {
    data,
    device,
    create: new CreateHouseholdUseCase(
      households,
      households,
      hasher,
      new TestIds(),
      clock,
      limiter,
    ),
    join: new JoinHouseholdUseCase(households, households, hasher, clock, limiter),
    leave: new LeaveHouseholdUseCase(households, households, clock),
    mine: new GetMyHouseholdUseCase(households),
    append: new AppendHouseholdRecordsUseCase(households, households, clock, limiter),
    list: new ListHouseholdRecordsUseCase(households),
  };
}

describe('CreateHouseholdUseCase', () => {
  it('starts a household with the caller as its only member', async () => {
    const s = setup();
    const userId = await s.device();

    const created = await s.create.execute({ userId, joinToken: TOKEN });

    expect(created.memberCount).toBe(1);
    await expect(s.mine.execute({ userId })).resolves.toEqual(created);
  });

  it('refuses a caller already in a household', async () => {
    const s = setup();
    const userId = await s.device();
    await s.create.execute({ userId, joinToken: TOKEN });

    await expect(s.create.execute({ userId, joinToken: TOKEN })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it('limits how many a caller creates', async () => {
    const s = setup(1);
    const userId = await s.device();
    await s.create.execute({ userId, joinToken: TOKEN });
    await s.leave.execute({ userId });

    await expect(s.create.execute({ userId, joinToken: TOKEN })).rejects.toBeInstanceOf(
      RateLimitedError,
    );
  });
});

describe('JoinHouseholdUseCase', () => {
  it('joins with the right token', async () => {
    const s = setup();
    const [owner, partner] = [await s.device(), await s.device()];
    const { householdId } = await s.create.execute({ userId: owner, joinToken: TOKEN });

    await expect(
      s.join.execute({ userId: partner, householdId, joinToken: TOKEN }),
    ).resolves.toEqual({ householdId, memberCount: 2 });
  });

  it('does nothing when joining the household the caller is in', async () => {
    const s = setup();
    const owner = await s.device();
    const { householdId } = await s.create.execute({ userId: owner, joinToken: TOKEN });

    await expect(s.join.execute({ userId: owner, householdId, joinToken: TOKEN })).resolves.toEqual(
      { householdId, memberCount: 1 },
    );
  });

  it('refuses a wrong token, an unknown household and another household', async () => {
    const s = setup();
    const [owner, partner, other] = [await s.device(), await s.device(), await s.device()];
    const { householdId } = await s.create.execute({ userId: owner, joinToken: TOKEN });
    await s.create.execute({ userId: other, joinToken: TOKEN });

    await expect(
      s.join.execute({ userId: partner, householdId, joinToken: 'x'.repeat(43) }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      s.join.execute({ userId: partner, householdId: s.data.householdId(), joinToken: TOKEN }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      s.join.execute({ userId: other, householdId, joinToken: TOKEN }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('refuses a full household', async () => {
    const s = setup();
    const owner = await s.device();
    const { householdId } = await s.create.execute({ userId: owner, joinToken: TOKEN });
    for (let i = 1; i < HOUSEHOLD_MAX_MEMBERS; i++) {
      await s.join.execute({ userId: await s.device(), householdId, joinToken: TOKEN });
    }

    await expect(
      s.join.execute({ userId: await s.device(), householdId, joinToken: TOKEN }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('limits attempts, so tokens cannot be guessed', async () => {
    const s = setup(1);
    const [owner, partner] = [await s.device(), await s.device()];
    const { householdId } = await s.create.execute({ userId: owner, joinToken: TOKEN });
    const guess = () => s.join.execute({ userId: partner, householdId, joinToken: 'x'.repeat(43) });

    await expect(guess()).rejects.toBeInstanceOf(ValidationError);
    await expect(guess()).rejects.toBeInstanceOf(RateLimitedError);
  });
});

describe('LeaveHouseholdUseCase and GetMyHouseholdUseCase', () => {
  it('leaves, and then the caller has no household', async () => {
    const s = setup();
    const [owner, partner] = [await s.device(), await s.device()];
    const { householdId } = await s.create.execute({ userId: owner, joinToken: TOKEN });
    await s.join.execute({ userId: partner, householdId, joinToken: TOKEN });

    await s.leave.execute({ userId: partner });

    await expect(s.mine.execute({ userId: partner })).rejects.toBeInstanceOf(NotFoundError);
    await expect(s.mine.execute({ userId: owner })).resolves.toEqual({
      householdId,
      memberCount: 1,
    });
  });

  it('does nothing for a caller in no household', async () => {
    const s = setup();

    await expect(s.leave.execute({ userId: await s.device() })).resolves.toBeUndefined();
  });
});

describe('AppendHouseholdRecordsUseCase and ListHouseholdRecordsUseCase', () => {
  it('shares records with the other members, marking whose they are', async () => {
    const s = setup();
    const [owner, partner] = [await s.device(), await s.device()];
    const { householdId } = await s.create.execute({ userId: owner, joinToken: TOKEN });
    await s.join.execute({ userId: partner, householdId, joinToken: TOKEN });

    const { seqs } = await s.append.execute({ userId: owner, sealed: ['YQ', 'Yg'] });
    await s.append.execute({ userId: partner, sealed: ['Yw'] });

    const listed = await s.list.execute({ userId: partner, afterSeq: 0 });
    expect(listed).toEqual({
      records: [
        { seq: seqs[0], sealed: 'YQ', mine: false },
        { seq: seqs[1], sealed: 'Yg', mine: false },
        expect.objectContaining({ sealed: 'Yw', mine: true }),
      ],
      hasMore: false,
    });
  });

  it('pages with afterSeq and limit', async () => {
    const s = setup();
    const owner = await s.device();
    await s.create.execute({ userId: owner, joinToken: TOKEN });
    const { seqs } = await s.append.execute({ userId: owner, sealed: ['YQ', 'Yg', 'Yw'] });

    const page = await s.list.execute({ userId: owner, afterSeq: seqs[0] ?? 0, limit: 1 });

    expect(page.records.map((r) => r.sealed)).toEqual(['Yg']);
    expect(page.hasMore).toBe(true);
  });

  it('refuses callers in no household, after leaving too', async () => {
    const s = setup();
    const owner = await s.device();
    await s.create.execute({ userId: owner, joinToken: TOKEN });
    await s.leave.execute({ userId: owner });

    await expect(s.append.execute({ userId: owner, sealed: ['YQ'] })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(s.list.execute({ userId: owner, afterSeq: 0 })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it.each([[[]], [Array.from({ length: 51 }, () => 'YQ')], [['not sealed!']]])(
    'refuses %j',
    async (sealed) => {
      const s = setup();
      const owner = await s.device();
      await s.create.execute({ userId: owner, joinToken: TOKEN });

      await expect(s.append.execute({ userId: owner, sealed })).rejects.toBeInstanceOf(
        ValidationError,
      );
    },
  );
});
