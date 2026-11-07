import { CreatePlaceUseCase, ZodInputValidator } from '@amexbutikker/application';
import { DuplicatePlaceError, RateLimitedError, ValidationError } from '@amexbutikker/contracts';
import type { CreatePlaceInput, IdGenerator, PlaceId, UserId } from '@amexbutikker/contracts';
import { OSLO_S, TestData, offset } from '@amexbutikker/contracts/test-kit';
import { NameDistancePlaceDuplicateMatcher, TrigramNameSimilarity } from '@amexbutikker/domain';
import {
  EmptyInMemoryTablesFactory,
  InMemoryPlaceRepository,
  InMemoryRateLimiter,
} from '@amexbutikker/in-memory';
import { describe, expect, it } from 'vitest';

const clock = { now: () => new Date('2026-11-07T12:00:00.000Z') };
const user = '0190a000-0000-7000-8000-0000000000aa' as UserId;

class SequenceIds implements Pick<IdGenerator, 'placeId'> {
  private count = 0;

  public placeId(): PlaceId {
    this.count += 1;
    return `0190a000-0000-7000-8000-${String(this.count).padStart(12, '0')}` as PlaceId;
  }
}

function setup(limit = 10) {
  const tables = new EmptyInMemoryTablesFactory().create();
  const names = new TrigramNameSimilarity();
  const places = new InMemoryPlaceRepository(tables, names, clock);
  const ids = new SequenceIds() as unknown as IdGenerator;
  const useCase = new CreatePlaceUseCase(
    places,
    places,
    new NameDistancePlaceDuplicateMatcher(names),
    ids,
    clock,
    new InMemoryRateLimiter({ create_place: { limit, windowSeconds: 3600 } }, clock),
    new ZodInputValidator(),
    { duplicateRadiusM: 150, duplicateCandidates: 20 },
  );
  return { places, useCase };
}

function physical(overrides: Partial<Extract<CreatePlaceInput, { kind: 'physical' }>> = {}) {
  return {
    kind: 'physical' as const,
    userId: user,
    name: 'Kafé Åsen',
    category: 'cafe' as const,
    address: { street: 'Karl Johans gate 1', postcode: '0154', city: 'Oslo' },
    location: OSLO_S,
    website: null,
    ...overrides,
  };
}

function online(overrides: Partial<Extract<CreatePlaceInput, { kind: 'online' }>> = {}) {
  return {
    kind: 'online' as const,
    userId: user,
    name: 'Komplett',
    website: 'https://www.komplett.no/',
    ...overrides,
  };
}

describe('CreatePlaceUseCase', () => {
  it('creates a physical place and returns it', async () => {
    const { places, useCase } = setup();

    const place = await useCase.execute(physical());

    expect(place).toMatchObject({ kind: 'physical', name: 'Kafé Åsen', chainId: null });
    await expect(places.getById(place.id)).resolves.toEqual(place);
  });

  it('creates an online shop in the online_shop category', async () => {
    const { useCase } = setup();

    await expect(useCase.execute(online())).resolves.toMatchObject({
      kind: 'online',
      category: 'online_shop',
    });
  });

  it('refuses a physical place with a similar name nearby, naming the stored one', async () => {
    const { places, useCase } = setup();
    const stored = new TestData().physicalPlace({
      name: 'Kafe Asen',
      location: offset(OSLO_S, 40),
    });
    await places.create(stored);

    const attempt = useCase.execute(physical());

    await expect(attempt).rejects.toBeInstanceOf(DuplicatePlaceError);
    await expect(attempt).rejects.toMatchObject({ existing: { id: stored.id } });
  });

  it('creates it anyway when the user says it is another place', async () => {
    const { places, useCase } = setup();
    await places.create(new TestData().physicalPlace({ name: 'Kafé Åsen', location: OSLO_S }));

    await expect(useCase.execute(physical({ allowDuplicate: true }))).resolves.toMatchObject({
      name: 'Kafé Åsen',
    });
  });

  it('allows the same name further away', async () => {
    const { places, useCase } = setup();
    await places.create(
      new TestData().physicalPlace({ name: 'Kafé Åsen', location: offset(OSLO_S, 500) }),
    );

    await expect(useCase.execute(physical())).resolves.toMatchObject({ name: 'Kafé Åsen' });
  });

  it('refuses an online shop on the same website under another name', async () => {
    const { places, useCase } = setup();
    const stored = new TestData().onlinePlace({
      name: 'Komplett',
      website: 'https://komplett.no/',
    });
    await places.create(stored);

    await expect(
      useCase.execute(online({ name: 'Komplett.no AS', website: 'https://www.komplett.no/pc' })),
    ).rejects.toMatchObject({ existing: { id: stored.id } });
  });

  it('allows an online shop with another name and website, also on a bare host', async () => {
    const { places, useCase } = setup();
    await places.create(
      new TestData().onlinePlace({ name: 'Komplett', website: 'https://komplett.no/' }),
    );

    await expect(
      useCase.execute(online({ name: 'Elkjøp', website: 'https://elkjop.no/' })),
    ).resolves.toMatchObject({ name: 'Elkjøp' });
    await expect(
      useCase.execute(online({ name: 'Intranett', website: 'http://intranett/' })),
    ).resolves.toMatchObject({ name: 'Intranett' });
  });

  it('validates before looking for duplicates, and rate-limits first', async () => {
    const { useCase } = setup(1);

    await expect(useCase.execute(physical({ name: '' }))).rejects.toBeInstanceOf(ValidationError);
    await expect(useCase.execute(physical())).rejects.toBeInstanceOf(RateLimitedError);
  });
});
