import {
  CalculatingPlaceStatusRefresher,
  SubmitReportUseCase,
  ZodInputValidator,
} from '@amexbutikker/application';
import type { Clock, PlaceId, ReportChannel, TransactionalPorts } from '@amexbutikker/contracts';
import { TestData } from '@amexbutikker/contracts/test-kit';
import {
  AttestationReportEvidencePolicy,
  DecayingAcceptanceStatusCalculator,
  FixedEvidenceWeightPolicy,
  ProportionChainHintCalculator,
  TrigramNameSimilarity,
} from '@amexbutikker/domain';
import {
  EmptyInMemoryTablesFactory,
  InMemoryChainRepository,
  InMemoryDeviceRepository,
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

async function setup(options: { trustUnattested?: boolean } = {}) {
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
  const devices = new InMemoryDeviceRepository(tables);
  const useCase = new SubmitReportUseCase(
    unitOfWork,
    new CalculatingPlaceStatusRefresher(
      new DecayingAcceptanceStatusCalculator(new FixedEvidenceWeightPolicy()),
      new ProportionChainHintCalculator(),
      clock,
    ),
    devices,
    new AttestationReportEvidencePolicy({ trustUnattested: options.trustUnattested ?? false }),
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
  /** A registered device, attested unless told otherwise. */
  const device = async (attested = true) => {
    const userId = data.userId();
    await devices.create({ userId, platform: 'ios', createdAt: T0 });
    if (attested) {
      await devices.saveAttestation(userId, { kind: 'app_attest', attestedAt: T0, keyId: userId });
    }
    return userId;
  };
  return { data, useCase, place, evidenceOn, device };
}

describe('SubmitReportUseCase', () => {
  it('appends a user report from the app by default', async () => {
    const { useCase, place, evidenceOn, device } = await setup();
    const userId = await device();

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
    const { useCase, place, evidenceOn, device } = await setup();

    await useCase.execute({ userId: await device(), placeId: place.id, result: 'accepted', via });

    expect(evidenceOn(place.id)).toEqual([expect.objectContaining({ kind, source })]);
  });

  it('gives Trolig ja, verified, for one wallet payment', async () => {
    const { useCase, place, device } = await setup();

    const output = await useCase.execute({
      userId: await device(),
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
    const { useCase, place, evidenceOn, device } = await setup();

    await useCase.execute({
      userId: await device(),
      placeId: place.id,
      result: 'rejected',
      note: '  Bare Visa  ',
    });

    expect(evidenceOn(place.id)[0]?.note).toBe('Bare Visa');
  });

  it.each(['app', 'wallet'] as const)(
    'counts an answer via %s from an unattested device as unverified',
    async (via) => {
      const { useCase, place, evidenceOn, device } = await setup();

      const output = await useCase.execute({
        userId: await device(false),
        placeId: place.id,
        result: 'accepted',
        via,
      });

      expect(evidenceOn(place.id)).toEqual([
        expect.objectContaining({ kind: 'unverified_report', source: 'app' }),
      ]);
      expect(output.status.basis).toBe('unverified_report');
    },
  );

  it('needs four unattested devices for a Ja', async () => {
    const { useCase, place, device } = await setup();
    const statuses: string[] = [];

    for (let i = 0; i < 4; i += 1) {
      const output = await useCase.execute({
        userId: await device(false),
        placeId: place.id,
        result: 'accepted',
      });
      statuses.push(output.status.status);
    }

    expect(statuses).toEqual(['likely_accepted', 'likely_accepted', 'likely_accepted', 'accepted']);
  });

  it('trusts unattested devices when configured to', async () => {
    const { useCase, place, evidenceOn, device } = await setup({ trustUnattested: true });

    await useCase.execute({
      userId: await device(false),
      placeId: place.id,
      result: 'accepted',
      via: 'wallet',
    });

    expect(evidenceOn(place.id)).toEqual([
      expect.objectContaining({ kind: 'visit_report', source: 'wallet' }),
    ]);
  });
});
