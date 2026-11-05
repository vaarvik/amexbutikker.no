import { describe, expect, it } from 'vitest';
import { CategoryDwellVisitCandidateRanker } from '../../src/visits/category-dwell-visit-candidate.ranker';
import { ANNOUNCE_ID, ASK_ID, region } from './visits-test.data';

const MIN = 60_000;
const range = (minMinutes: number, maxMinutes: number) => ({
  minMs: minMinutes * MIN,
  maxMs: maxMinutes * MIN,
});
const ranker = new CategoryDwellVisitCandidateRanker({
  dwellRanges: {
    shop: range(1, 30),
    cafe: range(5, 60),
    fast_food: range(5, 40),
    restaurant: range(30, 150),
    bar: range(20, 180),
    pub: range(20, 180),
    hotel: range(10, 600),
    online_shop: range(1, 30),
    other: range(2, 60),
  },
  timeWeight: 0.6,
  categoryWeight: 0.4,
});

const kiosk = region(ASK_ID, 'ask', 'Narvesen', 'shop');
const restaurant = region(ANNOUNCE_ID, 'ask', "O'Learys", 'restaurant');

describe('CategoryDwellVisitCandidateRanker', () => {
  it('prefers the place whose category fits a short visit', () => {
    const ranked = ranker.rank([
      { region: restaurant, insideMs: 3 * MIN },
      { region: kiosk, insideMs: 3 * MIN },
    ]);

    expect(ranked.map((r) => r.candidate.name)).toEqual(['Narvesen', "O'Learys"]);
    expect(ranked[0]?.score).toBe(1);
    expect(ranked[1]?.score).toBeCloseTo(0.6 + 0.4 * (3 / 30));
  });

  it('prefers the fence the phone stayed in longest', () => {
    const ranked = ranker.rank([
      { region: kiosk, insideMs: 2 * MIN },
      { region: region(ANNOUNCE_ID, 'ask', 'Butikk B', 'shop'), insideMs: 10 * MIN },
    ]);

    expect(ranked.map((r) => r.candidate.name)).toEqual(['Butikk B', 'Narvesen']);
    expect(ranked[1]?.score).toBeCloseTo(0.6 * 0.2 + 0.4);
  });

  it('marks down a visit longer than the category usually takes', () => {
    const [ranked] = ranker.rank([{ region: kiosk, insideMs: 60 * MIN }]);

    expect(ranked?.score).toBeCloseTo(0.6 + 0.4 * 0.5);
  });

  it('keeps the input order on a tie, which is nearest first', () => {
    const twin = region(ANNOUNCE_ID, 'ask', 'Narvesen 2', 'shop');
    const ranked = ranker.rank([
      { region: kiosk, insideMs: 3 * MIN },
      { region: twin, insideMs: 3 * MIN },
    ]);

    expect(ranked.map((r) => r.candidate.name)).toEqual(['Narvesen', 'Narvesen 2']);
  });

  it('returns nothing without time inside', () => {
    expect(ranker.rank([])).toEqual([]);
    expect(ranker.rank([{ region: kiosk, insideMs: 0 }])).toEqual([]);
  });
});
