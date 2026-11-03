import { CalculatingPlaceStatusRefresher } from '@amexbutikker/application';
import type { Clock, TransactionalPorts } from '@amexbutikker/contracts';
import { NotFoundError } from '@amexbutikker/contracts';
import { TestData } from '@amexbutikker/contracts/test-kit';
import {
  DecayingAcceptanceStatusCalculator,
  DefaultEvidenceWeightPolicy,
  ProportionChainHintCalculator,
  TrigramNameSimilarity,
} from '@amexbutikker/domain';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  EmptyInMemoryTablesFactory,
  InMemoryChainRepository,
  InMemoryEvidenceRepository,
  InMemoryPlaceRepository,
  InMemoryPlaceStatusRepository,
} from '@amexbutikker/in-memory';

const NOW = new Date('2026-01-02T12:00:00.000Z');
const clock: Clock = { now: () => NOW };

describe('CalculatingPlaceStatusRefresher', () => {
  const refresher = new CalculatingPlaceStatusRefresher(
    new DecayingAcceptanceStatusCalculator(new DefaultEvidenceWeightPolicy()),
    new ProportionChainHintCalculator(),
    clock,
  );
  let ports: TransactionalPorts;
  let data: TestData;

  beforeEach(() => {
    const tables = new EmptyInMemoryTablesFactory().create();
    ports = {
      places: new InMemoryPlaceRepository(tables, new TrigramNameSimilarity(), clock),
      chains: new InMemoryChainRepository(tables, new TrigramNameSimilarity(), clock),
      evidence: new InMemoryEvidenceRepository(tables),
      statuses: new InMemoryPlaceStatusRepository(tables),
    };
    data = new TestData();
  });

  it('stores the place status and the chain hint', async () => {
    const chain = data.chain();
    await ports.chains.create(chain);
    const accepting = data.physicalPlace({ chainId: chain.id });
    const rejecting = data.physicalPlace({ chainId: chain.id });
    const silent = data.physicalPlace({ chainId: chain.id });
    for (const place of [accepting, rejecting, silent]) {
      await ports.places.create(place);
    }
    await ports.evidence.append(
      data.evidence({ target: { type: 'place', placeId: accepting.id }, observedAt: NOW }),
    );
    await ports.evidence.append(
      data.evidence({
        target: { type: 'place', placeId: rejecting.id },
        result: 'rejected',
        observedAt: NOW,
      }),
    );
    await ports.evidence.append(
      data.evidence({
        target: { type: 'chain', chainId: chain.id },
        kind: 'chain_confirmation',
        userId: null,
        source: 'curated',
        observedAt: NOW,
      }),
    );

    await refresher.refresh(ports, rejecting.id);
    await refresher.refresh(ports, silent.id);
    const output = await refresher.refresh(ports, accepting.id);

    expect(output.status.status).toBe('accepted');
    expect(output.chainHint).toEqual({
      chainId: chain.id,
      acceptedCount: 1,
      totalWithEvidence: 2,
      calculatedAt: NOW,
    });
    await expect(ports.chains.findHint(chain.id)).resolves.toEqual(output.chainHint);
    await expect(ports.statuses.find(silent.id)).resolves.toMatchObject({
      status: { status: 'accepted', basis: 'chain_confirmation' },
    });
    await expect(ports.statuses.find(rejecting.id)).resolves.toMatchObject({
      status: { status: 'rejected' },
    });
  });

  it('has no chain hint for a place without a chain', async () => {
    const place = data.onlinePlace();
    await ports.places.create(place);

    await expect(refresher.refresh(ports, place.id)).resolves.toMatchObject({
      status: { status: 'unknown' },
      chainHint: null,
    });
  });

  it('throws NotFoundError for an unknown place', async () => {
    await expect(refresher.refresh(ports, data.placeId())).rejects.toBeInstanceOf(NotFoundError);
  });
});
