import type { ChainId, Evidence, PlaceId, PlaceStatus } from '@amexbutikker/contracts';
import { UNKNOWN_PLACE_STATUS } from '@amexbutikker/contracts';
import { TestData, daysAfter, T0 } from '@amexbutikker/contracts/test-kit';
import { beforeEach, describe, expect, it } from 'vitest';
import { LatestEvidenceSummarizer } from '../../src/index.js';

describe('LatestEvidenceSummarizer', () => {
  const summarizer = new LatestEvidenceSummarizer();
  let data: TestData;
  let placeId: PlaceId;
  let chainId: ChainId;

  beforeEach(() => {
    data = new TestData();
    placeId = data.placeId();
    chainId = data.chainId();
  });

  const onPlace = (overrides: Partial<Evidence> = {}): Evidence =>
    data.evidence({ target: { type: 'place', placeId }, ...overrides });
  const onChain = (overrides: Partial<Evidence> = {}): Evidence =>
    data.evidence({
      target: { type: 'chain', chainId },
      kind: 'chain_confirmation',
      userId: null,
      source: 'curated',
      ...overrides,
    });
  const status = (overrides: Partial<PlaceStatus>): PlaceStatus => ({
    status: 'accepted',
    confidence: 0.5,
    basis: 'user_report',
    verified: false,
    lastEvidenceAt: T0,
    ...overrides,
  });

  it('explains an external claim with its source and fetch date', () => {
    const claim = onPlace({
      kind: 'external_list',
      source: 'kredittkort360',
      userId: null,
      observedAt: daysAfter(T0, -30),
    });

    const { basis } = summarizer.summarize([claim], [], status({ basis: 'external_list' }), null);

    expect(basis).toEqual({
      kind: 'external_list',
      scope: 'place',
      source: 'kredittkort360',
      observedAt: daysAfter(T0, -30),
      userAccepted: 0,
      userRejected: 0,
    });
  });

  it('attributes chain confirmation to the chain', () => {
    const { basis } = summarizer.summarize(
      [],
      [onChain({ observedAt: T0 })],
      status({ basis: 'chain_confirmation' }),
      null,
    );

    expect(basis).toMatchObject({
      kind: 'chain_confirmation',
      scope: 'chain',
      source: 'curated',
      observedAt: T0,
    });
  });

  it('counts users by their current report and uses the newest report as source date', () => {
    const changed = data.userId();
    const evidence = [
      onPlace({ userId: changed, result: 'rejected', observedAt: T0 }),
      onPlace({ userId: changed, result: 'accepted', observedAt: daysAfter(T0, 2) }),
      onPlace({ result: 'accepted', observedAt: daysAfter(T0, 1) }),
      onPlace({ result: 'rejected', observedAt: daysAfter(T0, 1) }),
    ];

    const { basis } = summarizer.summarize(evidence, [], status({ basis: 'user_report' }), null);

    expect(basis).toEqual({
      kind: 'user_report',
      scope: 'place',
      source: 'app',
      observedAt: daysAfter(T0, 2),
      userAccepted: 2,
      userRejected: 1,
    });
  });

  it('has no basis for an unknown status', () => {
    const { basis } = summarizer.summarize([], [], UNKNOWN_PLACE_STATUS, null);

    expect(basis).toEqual({
      kind: null,
      scope: 'none',
      source: null,
      observedAt: null,
      userAccepted: 0,
      userRejected: 0,
    });
  });

  it('lists the five newest notes from current reports, without user ids', () => {
    const withdrawn = data.userId();
    const evidence = [
      ...[1, 2, 3, 4, 5, 6].map((day) =>
        onPlace({ note: `note ${String(day)}`, observedAt: daysAfter(T0, day) }),
      ),
      onPlace({ userId: withdrawn, note: 'gone', observedAt: daysAfter(T0, 10) }),
      onPlace({ userId: withdrawn, result: 'withdrawn', observedAt: daysAfter(T0, 11) }),
      onPlace({ note: null, observedAt: daysAfter(T0, 12) }),
    ];

    const { latestNotes } = summarizer.summarize(evidence, [], status({}), null);

    expect(latestNotes).toEqual(
      [6, 5, 4, 3, 2].map((day) => ({
        result: 'accepted',
        note: `note ${String(day)}`,
        observedAt: daysAfter(T0, day),
      })),
    );
  });

  it('reports the caller’s current report, or null', () => {
    const me = data.userId();
    const evidence = [
      onPlace({ userId: me, result: 'accepted', observedAt: T0 }),
      onPlace({ userId: me, result: 'rejected', observedAt: daysAfter(T0, 1) }),
    ];

    expect(summarizer.summarize(evidence, [], status({}), me).myReport).toBe('rejected');
    expect(summarizer.summarize(evidence, [], status({}), data.userId()).myReport).toBeNull();
    expect(summarizer.summarize(evidence, [], status({}), null).myReport).toBeNull();
  });

  it('returns null myReport after the caller withdrew', () => {
    const me = data.userId();
    const evidence = [
      onPlace({ userId: me, observedAt: T0 }),
      onPlace({ userId: me, result: 'withdrawn', observedAt: daysAfter(T0, 1) }),
    ];

    expect(summarizer.summarize(evidence, [], status({}), me).myReport).toBeNull();
  });
});
