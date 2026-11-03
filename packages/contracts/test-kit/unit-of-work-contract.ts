import { describe, expect, it } from 'vitest';
import type { PlaceReader, UnitOfWork } from '../src/index.js';
import { FixtureHolder } from './fixture.js';
import type { FixtureFactory } from './fixture.js';
import { TestData } from './test-data.js';

export interface UnitOfWorkFixture {
  readonly unitOfWork: UnitOfWork;
  /** A reader outside any transaction, used to observe commits. */
  readonly places: PlaceReader;
}

/** Behaviour every UnitOfWork must have. */
export function describeUnitOfWorkContract(
  name: string,
  factory: FixtureFactory<UnitOfWorkFixture>,
): void {
  describe(`${name} satisfies UnitOfWork`, () => {
    const fixture = new FixtureHolder(factory);

    it('commits when the work resolves and returns its value', async () => {
      const place = new TestData().physicalPlace();

      const result = await fixture.current.unitOfWork.run(async (ports) => {
        await ports.places.create(place);
        return 'done';
      });

      expect(result).toBe('done');
      await expect(fixture.current.places.getById(place.id)).resolves.toEqual(place);
    });

    it('rolls back every write when the work rejects, and rethrows the same error', async () => {
      const data = new TestData();
      const place = data.physicalPlace();
      const failure = new Error('boom');

      const run = fixture.current.unitOfWork.run(async (ports) => {
        await ports.places.create(place);
        await ports.evidence.append(
          data.evidence({ target: { type: 'place', placeId: place.id } }),
        );
        throw failure;
      });

      await expect(run).rejects.toBe(failure);
      await expect(fixture.current.places.search({ text: place.name, limit: 5 })).resolves.toEqual(
        [],
      );
    });

    it('lets the work read its own writes', async () => {
      const data = new TestData();
      const place = data.physicalPlace();
      const evidence = data.evidence({ target: { type: 'place', placeId: place.id } });

      const listed = await fixture.current.unitOfWork.run(async (ports) => {
        await ports.places.create(place);
        await ports.evidence.append(evidence);
        return ports.evidence.listForPlace(place.id);
      });

      expect(listed).toEqual([evidence]);
    });

    it('serialises concurrent runs that touch the same place', async () => {
      const data = new TestData();
      const place = data.physicalPlace();
      await fixture.current.unitOfWork.run((ports) => ports.places.create(place));
      const target = { type: 'place', placeId: place.id } as const;

      const counts = await Promise.all(
        [0, 1, 2, 3].map(() =>
          fixture.current.unitOfWork.run(async (ports) => {
            const before = await ports.evidence.listForPlace(place.id);
            await ports.evidence.append(data.evidence({ target }));
            return before.length;
          }),
        ),
      );

      expect([...counts].sort()).toEqual([0, 1, 2, 3]);
    });
  });
}
