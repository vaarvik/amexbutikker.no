import { SearchPlacesUseCase, ZodInputValidator } from '@amexbutikker/application';
import { ValidationError } from '@amexbutikker/contracts';
import { TestData } from '@amexbutikker/contracts/test-kit';
import { TrigramNameSimilarity } from '@amexbutikker/domain';
import {
  EmptyInMemoryTablesFactory,
  InMemoryPlaceRepository,
  InMemoryPlaceStatusRepository,
} from '@amexbutikker/in-memory';
import { describe, expect, it } from 'vitest';

const clock = { now: () => new Date('2026-11-03T12:00:00.000Z') };

describe('SearchPlacesUseCase', () => {
  function setup() {
    const tables = new EmptyInMemoryTablesFactory().create();
    const places = new InMemoryPlaceRepository(tables, new TrigramNameSimilarity(), clock);
    const statuses = new InMemoryPlaceStatusRepository(tables);
    const useCase = new SearchPlacesUseCase(places, statuses, new ZodInputValidator());
    return { places, statuses, useCase };
  }

  it('returns each hit with its stored status, or unknown when none is stored', async () => {
    const { places, statuses, useCase } = setup();
    const data = new TestData();
    const rated = data.physicalPlace({ name: 'Kafé Åsen' });
    const unrated = data.physicalPlace({ name: 'Kafé Åsen Bakeri' });
    await places.create(rated);
    await places.create(unrated);
    await statuses.save(data.statusSnapshot(rated.id));

    const output = await useCase.execute({ text: 'kafe asen', limit: 10 });

    const byId = new Map(output.results.map((result) => [result.place.id, result.status.status]));
    expect(byId).toEqual(
      new Map([
        [rated.id, 'accepted'],
        [unrated.id, 'unknown'],
      ]),
    );
  });

  it('rejects an invalid query', async () => {
    const { useCase } = setup();

    await expect(useCase.execute({ text: ' ', limit: 10 })).rejects.toBeInstanceOf(ValidationError);
  });
});
