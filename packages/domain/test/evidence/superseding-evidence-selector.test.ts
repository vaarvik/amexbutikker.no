import type { Evidence } from '@amexbutikker/contracts';
import { TestData, daysAfter, T0 } from '@amexbutikker/contracts/test-kit';
import { describe, expect, it } from 'vitest';
import { SupersedingEvidenceSelector } from '../../src/index.js';

describe('SupersedingEvidenceSelector', () => {
  const selector = new SupersedingEvidenceSelector();
  const data = new TestData();
  const placeId = data.placeId();
  const on = (overrides: Partial<Evidence> = {}): Evidence =>
    data.evidence({ target: { type: 'place', placeId }, ...overrides });
  const ids = (evidence: readonly Evidence[]) => evidence.map((item) => item.id).sort();

  it('keeps only the latest evidence per user', () => {
    const userId = data.userId();
    const old = on({ userId, observedAt: T0 });
    const latest = on({ userId, observedAt: daysAfter(T0, 1), result: 'rejected' });
    const other = on();

    expect(ids(selector.current([latest, old, other]))).toEqual(ids([latest, other]));
  });

  it('drops a user whose latest evidence is a withdrawal', () => {
    const userId = data.userId();

    expect(
      selector.current([
        on({ userId, observedAt: T0 }),
        on({ userId, result: 'withdrawn', observedAt: daysAfter(T0, 1) }),
      ]),
    ).toEqual([]);
  });

  it('supersedes imported evidence per kind and source', () => {
    const imported = (overrides: Partial<Evidence>) =>
      on({ userId: null, kind: 'external_list', source: 'list', ...overrides });
    const old = imported({ observedAt: T0 });
    const latest = imported({ observedAt: daysAfter(T0, 1) });
    const otherSource = imported({ source: 'other' });
    const otherKind = imported({ kind: 'checkout_logo' });

    expect(ids(selector.current([old, latest, otherSource, otherKind]))).toEqual(
      ids([latest, otherSource, otherKind]),
    );
  });

  it('breaks ties by importedAt, then id', () => {
    const userId = data.userId();
    const first = on({ userId, importedAt: T0 });
    const second = on({ userId, importedAt: daysAfter(T0, 1) });

    expect(selector.current([second, first])).toEqual([second]);
  });

  it('drops imported withdrawals', () => {
    expect(selector.current([on({ userId: null, result: 'withdrawn' })])).toEqual([]);
  });
});
