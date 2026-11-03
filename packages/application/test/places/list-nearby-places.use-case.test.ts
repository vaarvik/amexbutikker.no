import { ListNearbyPlacesUseCase, ZodInputValidator } from '@amexbutikker/application';
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

describe('ListNearbyPlacesUseCase', () => {
  function setup() {
    const tables = new EmptyInMemoryTablesFactory().create();
    const places = new InMemoryPlaceRepository(tables, new TrigramNameSimilarity(), clock);
    const statuses = new InMemoryPlaceStatusRepository(tables);
    const useCase = new ListNearbyPlacesUseCase(places, statuses, new ZodInputValidator());
    return { places, statuses, useCase };
  }

  it('lists places nearest first, with their stored status or unknown', async () => {
    const { places, statuses, useCase } = setup();
    const data = new TestData();
    const near = data.physicalPlace({ location: offset(OSLO_S, 50) });
    const far = data.physicalPlace({ location: offset(OSLO_S, 400) });
    await places.create(far);
    await places.create(near);
    await statuses.save(data.statusSnapshot(far.id));

    const output = await useCase.execute({ center: OSLO_S, radiusM: 1000, limit: 10 });

    expect(output.results.map((result) => [result.place.id, result.status.status])).toEqual([
      [near.id, 'unknown'],
      [far.id, 'accepted'],
    ]);
  });

  it('rejects a radius above the maximum', async () => {
    const { useCase } = setup();

    await expect(
      useCase.execute({ center: OSLO_S, radiusM: 1_000_000, limit: 10 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
