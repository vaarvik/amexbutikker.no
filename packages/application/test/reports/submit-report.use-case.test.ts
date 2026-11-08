import {
  CalculatingPlaceStatusRefresher,
  SubmitReportUseCase,
  ZodInputValidator,
} from '@amexbutikker/application';
import type { Clock, PlaceId, ReportChannel, TransactionalPorts } from '@amexbutikker/contracts';
import { TestData } from '@amexbutikker/contracts/test-kit';
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
  InMemoryRateLimiter,
  InMemoryUnitOfWork,
} from '@amexbutikker/in-memory';
import type { InMemoryTables } from '@amexbutikker/in-memory';
import { describe, expect, it } from 'vitest';

const T0 = new Date('2026-01-01T12:00:00.000Z');

class FixedClock implements Clock {
  public now(): Date {
    return T0;
  }
}

async function setup() {
  const clock = new FixedClock();
  const data = new TestData();
  const names = new TrigramNameSimilarity();
  const portsFor = (tables: InMemoryTables): TransactionalPorts => ({
    places: new InMemoryPlaceRepository(tables, names, clock),
    chains: new InMemoryChainRepository(tables, names, clock),
    evidence: new InMemoryEvidenceRepository(tables),
    statuses: new InMemoryPlaceStatusRepository(tables),
  });
  const tables = new EmptyInMemoryTablesFactory().create();
  const unitOfWork = new InMemoryUnitOfWork(tables, portsFor);
  const useCase = new SubmitReportUseCase(
    unitOfWork,
    new CalculatingPlaceStatusRefresher(
      new DecayingAcceptanceStatusCalculator(new FixedEvidenceWeightPolicy()),
      new ProportionChainHintCalculator(),
      clock,
    ),
    data,
    clock,
    new InMemoryRateLimiter({ submit_report: { limit: 100, windowSeconds: 60 } }, clock),
    new ZodInputValidator(),
  );
  const place = data.physicalPlace();
  await unitOfWork.run((ports) => ports.places.create(place));
  const evidenceOn = (placeId: PlaceId) =>
    [...tables.evidence.values()].filter(
      (evidence) => evidence.target.type === 'place' && evidence.target.placeId === placeId,
    );
  return { data, useCase, place, evidenceOn };
}

describe('SubmitReportUseCase', () => {
  it('appends a user report from the app by default', async () => {
    const { data, useCase, place, evidenceOn } = await setup();
    const userId = data.userId();

    const output = await useCase.execute({ userId, placeId: place.id, result: 'accepted' });

    expect(evidenceOn(place.id)).toEqual([
      expect.objectContaining({
        kind: 'user_report',
        source: 'app',
        result: 'accepted',
        userId,
        observedAt: T0,
      }),
    ]);
    expect(output.status.status).toBe('likely_accepted');
  });

  it.each<[ReportChannel, string, string]>([
    ['app', 'user_report', 'app'],
    ['wallet', 'visit_report', 'wallet'],
  ])('records a report via %s as %s from %s', async (via, kind, source) => {
    const { data, useCase, place, evidenceOn } = await setup();

    await useCase.execute({ userId: data.userId(), placeId: place.id, result: 'accepted', via });

    expect(evidenceOn(place.id)).toEqual([expect.objectContaining({ kind, source })]);
  });

  it('gives Trolig ja, verified, for one wallet payment', async () => {
    const { data, useCase, place } = await setup();

    const output = await useCase.execute({
      userId: data.userId(),
      placeId: place.id,
      result: 'accepted',
      via: 'wallet',
    });

    expect(output.status).toMatchObject({
      status: 'likely_accepted',
      basis: 'visit_report',
      verified: true,
    });
  });

  it('keeps the note', async () => {
    const { data, useCase, place, evidenceOn } = await setup();

    await useCase.execute({
      userId: data.userId(),
      placeId: place.id,
      result: 'rejected',
      note: '  Bare Visa  ',
    });

    expect(evidenceOn(place.id)[0]?.note).toBe('Bare Visa');
  });
});
