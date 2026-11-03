import { GetPlaceDetailsUseCase } from '@amexbutikker/application';
import { TestData } from '@amexbutikker/contracts/test-kit';
import {
  DecayingAcceptanceStatusCalculator,
  DefaultEvidenceWeightPolicy,
  LatestEvidenceSummarizer,
  TrigramNameSimilarity,
} from '@amexbutikker/domain';
import {
  EmptyInMemoryTablesFactory,
  InMemoryChainRepository,
  InMemoryEvidenceRepository,
  InMemoryPlaceRepository,
} from '@amexbutikker/in-memory';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-01-02T12:00:00.000Z');
const clock = { now: () => NOW };

describe('GetPlaceDetailsUseCase', () => {
  function setup() {
    const tables = new EmptyInMemoryTablesFactory().create();
    const names = new TrigramNameSimilarity();
    const places = new InMemoryPlaceRepository(tables, names, clock);
    const chains = new InMemoryChainRepository(tables, names, clock);
    const evidence = new InMemoryEvidenceRepository(tables);
    const useCase = new GetPlaceDetailsUseCase(
      places,
      chains,
      evidence,
      new DecayingAcceptanceStatusCalculator(new DefaultEvidenceWeightPolicy()),
      new LatestEvidenceSummarizer(),
      clock,
    );
    return { places, chains, evidence, useCase, data: new TestData() };
  }

  it('uses chain evidence and returns the chain and its hint for a chain place', async () => {
    const { places, chains, evidence, useCase, data } = setup();
    const chain = data.chain();
    const place = data.physicalPlace({ chainId: chain.id });
    await chains.create(chain);
    await places.create(place);
    await chains.saveHint(data.chainHint(chain.id));
    await evidence.append(
      data.evidence({
        target: { type: 'chain', chainId: chain.id },
        kind: 'chain_confirmation',
        result: 'accepted',
      }),
    );

    const details = await useCase.execute({ placeId: place.id });

    expect(details.chain?.id).toBe(chain.id);
    expect(details.chainHint?.chainId).toBe(chain.id);
    expect(details.status.basis).toBe('chain_confirmation');
    expect(details.myReport).toBeNull();
  });

  it('has no chain, hint or chain evidence for an online place', async () => {
    const { places, useCase, data } = setup();
    const place = data.onlinePlace();
    await places.create(place);

    const details = await useCase.execute({ placeId: place.id, userId: data.userId() });

    expect(details).toMatchObject({ chain: null, chainHint: null, myReport: null });
    expect(details.status.status).toBe('unknown');
  });
});
