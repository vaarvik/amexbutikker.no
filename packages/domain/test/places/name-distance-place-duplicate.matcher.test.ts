import { ValidationError } from '@amexbutikker/contracts';
import { TestData } from '@amexbutikker/contracts/test-kit';
import { describe, expect, it } from 'vitest';
import { NameDistancePlaceDuplicateMatcher, TrigramNameSimilarity } from '../../src/index.js';

describe('NameDistancePlaceDuplicateMatcher', () => {
  const names = new TrigramNameSimilarity();
  const matcher = new NameDistancePlaceDuplicateMatcher(names);
  const data = new TestData();

  describe('physical places', () => {
    it('finds a place with the same name nearby, ignoring case and accents', () => {
      const existing = data.physicalPlace({ name: 'Kafé Åsen' });

      expect(
        matcher.findDuplicate(data.physicalPlace({ name: 'kafe asen' }), [
          { place: existing, distanceM: 30 },
        ]),
      ).toBe(existing);
    });

    it('takes the most similar name, then the nearest', () => {
      const close = data.physicalPlace({ name: 'Narvesen Storgata' });
      const exact = data.physicalPlace({ name: 'Narvesen Oslo S' });
      const twin = data.physicalPlace({ name: 'Narvesen Oslo S' });

      expect(
        matcher.findDuplicate(data.physicalPlace({ name: 'Narvesen Oslo S' }), [
          { place: close, distanceM: 5 },
          { place: exact, distanceM: 60 },
          { place: twin, distanceM: 40 },
        ]),
      ).toBe(twin);
    });

    it('ignores places that are too far away, or have no distance', () => {
      const place = data.physicalPlace({ name: 'Kafé Åsen' });

      expect(
        matcher.findDuplicate(data.physicalPlace({ name: 'Kafé Åsen' }), [
          { place, distanceM: 76 },
          { place, distanceM: null },
        ]),
      ).toBeNull();
    });

    it('ignores different names nearby, and online places', () => {
      expect(
        matcher.findDuplicate(data.physicalPlace({ name: 'Kafé Åsen' }), [
          { place: data.physicalPlace({ name: 'Bokhandel' }), distanceM: 5 },
          { place: data.onlinePlace({ name: 'Kafé Åsen' }), distanceM: null },
        ]),
      ).toBeNull();
    });
  });

  describe('online places', () => {
    it('finds a shop with the same website host, ignoring www, case and path', () => {
      const existing = data.onlinePlace({ name: 'Komplett', website: 'https://www.komplett.no/' });

      expect(
        matcher.findDuplicate(
          data.onlinePlace({ name: 'Komplett.no', website: 'http://KOMPLETT.no/kampanje' }),
          [{ place: existing, distanceM: null }],
        ),
      ).toBe(existing);
    });

    it('finds a shop with an almost identical name on another address', () => {
      const existing = data.onlinePlace({ name: 'Komplett', website: 'https://komplett.no/' });

      expect(
        matcher.findDuplicate(
          data.onlinePlace({ name: 'komplett', website: 'https://komplett.se/' }),
          [{ place: existing, distanceM: null }],
        ),
      ).toBe(existing);
    });

    it('keeps shops with other names and other addresses apart', () => {
      expect(
        matcher.findDuplicate(
          data.onlinePlace({ name: 'Elkjøp', website: 'https://www.elkjop.no/' }),
          [
            {
              place: data.onlinePlace({ name: 'Power', website: 'https://www.power.no/' }),
              distanceM: null,
            },
            { place: data.physicalPlace({ name: 'Elkjøp' }), distanceM: 10 },
          ],
        ),
      ).toBeNull();
    });

    it('does not trip over websites that are not URLs, nor match them to each other', () => {
      const existing = data.onlinePlace({ name: 'Annet', website: 'not a url' });

      expect(
        matcher.findDuplicate(data.onlinePlace({ name: 'Noe', website: 'https://noe.no/' }), [
          { place: existing, distanceM: null },
        ]),
      ).toBeNull();
      expect(
        matcher.findDuplicate(data.onlinePlace({ name: 'Noe', website: 'not a url' }), [
          { place: existing, distanceM: null },
        ]),
      ).toBeNull();
    });
  });

  it.each([
    [{ maxDistanceM: 0 }, 'maxDistanceM'],
    [{ minNameSimilarity: 1.5 }, 'minNameSimilarity'],
    [{ minOnlineNameSimilarity: 0 }, 'minOnlineNameSimilarity'],
  ])('rejects the option %o', (options, path) => {
    expect(() => new NameDistancePlaceDuplicateMatcher(names, options)).toThrow(ValidationError);
    try {
      new NameDistancePlaceDuplicateMatcher(names, options);
    } catch (error) {
      expect((error as ValidationError).issues.map((issue) => issue.path[0])).toEqual([path]);
    }
  });
});
