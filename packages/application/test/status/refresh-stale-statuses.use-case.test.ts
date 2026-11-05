import {
  CalculatingPlaceStatusRefresher,
  RefreshStaleStatusesUseCase,
  ZodInputValidator,
} from '@amexbutikker/application';
import type { Clock, PlaceId, TransactionalPorts } from '@amexbutikker/contracts';
import { ValidationError } from '@amexbutikker/contracts';
import { TestData, daysAfter } from '@amexbutikker/contracts/test-kit';
import {
  DecayingAcceptanceStatusCalculator,
  FixedEvidenceWeightPolicy,
  ProportionChainHintCalculator,
  TrigramNameSimilarity,
} from '@amexbutikker/domain';
import {
  EmptyInMemoryTablesFactory,
  InMemoryChainRepository,
  InMemoryEvidenceRepository,
  InMemoryPlaceRepository,
  InMemoryPlaceStatusRepository,
  InMemoryUnitOfWork,
} from '@amexbutikker/in-memory';
import type { InMemoryTables } from '@amexbutikker/in-memory';
import { describe, expect, it } from 'vitest';

const T0 = new Date('2026-01-01T12:00:00.000Z');

/** A clock the test moves forward. */
class MovableClock implements Clock {
  public current = T0;
  public now(): Date {
    return this.current;
  }
}

function setup() {
  const clock = new MovableClock();
  const names = new TrigramNameSimilarity();
  const portsFor = (tables: InMemoryTables): TransactionalPorts => ({
    places: new InMemoryPlaceRepository(tables, names, clock),
    chains: new InMemoryChainRepository(tables, names, clock),
    evidence: new InMemoryEvidenceRepository(tables),
    statuses: new InMemoryPlaceStatusRepository(tables),
  });
  const tables = new EmptyInMemoryTablesFactory().create();
  const unitOfWork = new InMemoryUnitOfWork(tables, portsFor);
  const refresher = new CalculatingPlaceStatusRefresher(
    new DecayingAcceptanceStatusCalculator(new FixedEvidenceWeightPolicy()),
    new ProportionChainHintCalculator(),
    clock,
  );
  const useCase = new RefreshStaleStatusesUseCase(
    unitOfWork,
    refresher,
    clock,
    new ZodInputValidator(),
  );
  const statusOf = (placeId: PlaceId) => tables.statuses.get(placeId)?.status.status;
  return { clock, tables, unitOfWork, refresher, useCase, statusOf };
}

/** A place with two fresh user reports at T0, calculated at T0: Ja. */
async function confirmedPlace(env: ReturnType<typeof setup>, data: TestData): Promise<PlaceId> {
  const place = data.physicalPlace();
  await env.unitOfWork.run(async (ports) => {
    await ports.places.create(place);
    for (let i = 0; i < 2; i += 1) {
      await ports.evidence.append(
        data.evidence({ target: { type: 'place', placeId: place.id }, observedAt: T0 }),
      );
    }
    await env.refresher.refresh(ports, place.id);
  });
  return place.id;
}

describe('RefreshStaleStatusesUseCase', () => {
  it('lets an aged Ja fall back to Trolig ja', async () => {
    const env = setup();
    const placeId = await confirmedPlace(env, new TestData());
    expect(env.statusOf(placeId)).toBe('accepted');

    env.clock.current = daysAfter(T0, 200);
    const output = await env.useCase.execute({
      calculatedBefore: daysAfter(T0, 1),
      batchSize: 10,
    });

    expect(output).toEqual({ refreshed: 1 });
    expect(env.statusOf(placeId)).toBe('likely_accepted');
    expect(env.tables.statuses.get(placeId)?.calculatedAt).toEqual(daysAfter(T0, 200));
  });

  it('works through every stale place in batches and leaves fresh ones alone', async () => {
    const env = setup();
    const data = new TestData();
    for (let i = 0; i < 5; i += 1) {
      await confirmedPlace(env, data);
    }
    env.clock.current = daysAfter(T0, 30);
    const fresh = await confirmedPlace(env, data);

    const output = await env.useCase.execute({
      calculatedBefore: daysAfter(T0, 10),
      batchSize: 2,
    });

    expect(output).toEqual({ refreshed: 5 });
    expect(env.tables.statuses.get(fresh)?.calculatedAt).toEqual(daysAfter(T0, 30));
  });

  it('treats a cutoff in the future as now, so it finishes', async () => {
    const env = setup();
    await confirmedPlace(env, new TestData());
    env.clock.current = daysAfter(T0, 1);

    await expect(
      env.useCase.execute({ calculatedBefore: daysAfter(T0, 365), batchSize: 1 }),
    ).resolves.toEqual({ refreshed: 1 });
  });

  it('rejects a batch size out of range', async () => {
    const { useCase } = setup();

    await expect(useCase.execute({ calculatedBefore: T0, batchSize: 0 })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});
