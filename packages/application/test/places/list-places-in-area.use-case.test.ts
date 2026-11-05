import { ListPlacesInAreaUseCase, ZodInputValidator } from '@amexbutikker/application';
import { ValidationError } from '@amexbutikker/contracts';
import { OSLO_S, TestData, offset } from '@amexbutikker/contracts/test-kit';
import { TrigramNameSimilarity } from '@amexbutikker/domain';
import {
  EmptyInMemoryTablesFactory,
  InMemoryPlaceRepository,
  InMemoryPlaceStatusRepository,
} from '@amexbutikker/in-memory';
import { describe, expect, it } from 'vitest';

const clock = { now: () => new Date('2026-11-03T12:00:00.000Z') };
const bounds = {
  south: OSLO_S.lat - 0.01,
  west: OSLO_S.lng - 0.01,
  north: OSLO_S.lat + 0.01,
  east: OSLO_S.lng + 0.01,
};

describe('ListPlacesInAreaUseCase', () => {
  function setup() {
    const tables = new EmptyInMemoryTablesFactory().create();
    const places = new InMemoryPlaceRepository(tables, new TrigramNameSimilarity(), clock);
    const statuses = new InMemoryPlaceStatusRepository(tables);
    const useCase = new ListPlacesInAreaUseCase(places, statuses, new ZodInputValidator());
    return { places, statuses, useCase };
  }

  it('lists the places in the area with their status, without distances', async () => {
    const { places, statuses, useCase } = setup();
    const data = new TestData();
    const known = data.physicalPlace({ location: offset(OSLO_S, 50) });
    const other = data.physicalPlace({ location: offset(OSLO_S, 400) });
    await places.create(other);
    await places.create(known);
    await statuses.save(data.statusSnapshot(known.id));

    const output = await useCase.execute({ bounds, limit: 10 });

    expect(output.truncated).toBe(false);
    expect(
      output.results.map((result) => [result.place.id, result.status.status, result.distanceM]),
    ).toEqual([
      [known.id, 'accepted', null],
      [other.id, 'unknown', null],
    ]);
  });

  it('says when the area held more places than the limit', async () => {
    const { places, useCase } = setup();
    const data = new TestData();
    for (const metres of [10, 20, 30]) {
      await places.create(data.physicalPlace({ location: offset(OSLO_S, metres) }));
    }

    const cut = await useCase.execute({ bounds, limit: 2 });
    const exact = await useCase.execute({ bounds, limit: 3 });

    expect(cut).toMatchObject({ truncated: true });
    expect(cut.results).toHaveLength(2);
    expect(exact).toMatchObject({ truncated: false });
  });

  it.each([
    ['too large', { ...bounds, north: bounds.south + 1 }],
    ['upside down', { ...bounds, north: bounds.south - 0.01 }],
  ])('rejects an area that is %s', async (_, area) => {
    const { useCase } = setup();

    await expect(useCase.execute({ bounds: area, limit: 10 })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});
