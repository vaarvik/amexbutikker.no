import { TestData } from '@amexbutikker/contracts/test-kit';
import type { PhysicalPlace } from '@amexbutikker/contracts';
import { TrigramNameSimilarity } from '@amexbutikker/domain';
import { describe, expect, it } from 'vitest';
import { AddressBrregPlaceMatcher } from '../../../../src/imports/importers/brreg-underenheter/address-brreg-place.matcher.js';
import type { BrregUnderenhet } from '../../../../src/imports/importers/brreg-underenheter/brreg-underenheter.model.js';

const matcher = new AddressBrregPlaceMatcher(new TrigramNameSimilarity(), {
  minimumScore: 0.3,
  minimumLead: 0.05,
});
const data = new TestData();

function unit(overrides: Partial<BrregUnderenhet> = {}): BrregUnderenhet {
  return {
    orgnr: '912345678',
    name: 'REMA 1000 GRØNLAND AS',
    naceCode: '47.111',
    street: 'Grønlandsleiret 9',
    postcode: '0190',
    kommunenummer: '0301',
    closedOn: null,
    ...overrides,
  };
}

function place(name: string, street: string | null = 'Grønlandsleiret 9'): PhysicalPlace {
  return data.physicalPlace({ name, address: { street, postcode: '0190', city: 'Oslo' } });
}

describe('AddressBrregPlaceMatcher', () => {
  it('matches the place at the same address with a similar name, ignoring legal suffixes', () => {
    const rema = place('Rema 1000 Grønland');

    expect(matcher.match(unit(), [place('Kiwi', 'Tøyengata 2'), rema])).toMatchObject({
      kind: 'matched',
      place: rema,
    });
  });

  it('compares addresses ignoring case, accents and the space before a house letter', () => {
    const kafe = place('Kafé Åsen', 'Grønlandsleiret 9 B');

    expect(
      matcher.match(unit({ name: 'KAFE ASEN AS', street: 'GRØNLANDSLEIRET 9B' }), [kafe]),
    ).toMatchObject({ kind: 'matched', place: kafe });
  });

  it('picks the closest name when several places share the address', () => {
    const rema = place('Rema 1000 Grønland');

    expect(
      matcher.match(unit(), [place('Grønland Apotek'), rema, place('Narvesen')]),
    ).toMatchObject({
      kind: 'matched',
      place: rema,
    });
  });

  it('needs the first word of the place name in the registry name, so shops in one centre do not mix', () => {
    const anton = place('Anton Sport CC Vest');
    const candidates = [place("McDonald's CC Vest"), anton];

    expect(matcher.match(unit({ name: 'ANTON SPORT CC VEST' }), candidates)).toMatchObject({
      kind: 'matched',
      place: anton,
    });
    expect(matcher.match(unit({ name: 'SØSTRENE GRENE CC VEST' }), candidates)).toEqual({
      kind: 'unmatched',
      reason: 'no place at Grønlandsleiret 9, 0190 is named like "SØSTRENE GRENE CC VEST"',
    });
  });

  it.each([
    ['NG KIWI OSLO AKERSHUS AS AVD 397 RØA', 'Kiwi Røa'],
    ['VEROMODAOSLO.NO', 'Vero Moda'],
    ['SMOOTHIE XCHANGE AS AVD KARL JOHAN', 'Smoothiexhange'],
  ])('accepts the leading word inside or similar to a registry word: %s', (name, placeName) => {
    expect(matcher.match(unit({ name }), [place(placeName)])).toMatchObject({ kind: 'matched' });
  });

  it.each([
    ['NG AVD 397 RØA', '7-Eleven Røa'],
    ['VINMONOPOLET AS BUTIKK STOVNER', 'Telenorbutikken Stovner'],
  ])(
    'does not count a short word, or a registry word inside the place word: %s',
    (name, placeName) => {
      expect(matcher.match(unit({ name }), [place(placeName)])).toMatchObject({
        kind: 'unmatched',
      });
    },
  );

  it.each([
    [unit({ street: null }), [place('Rema 1000 Grønland')], 'has no street address'],
    [unit(), [place('Rema 1000 Grønland', 'Tøyengata 2')], 'no place at Grønlandsleiret 9, 0190'],
    [unit(), [place('Rema 1000 Grønland', null)], 'no place at Grønlandsleiret 9, 0190'],
    [
      unit({ name: 'NORDIC HOLDING AS' }),
      [place('Rema 1000 Grønland')],
      'no place at Grønlandsleiret 9, 0190 is named like "NORDIC HOLDING AS"',
    ],
    [
      unit({ name: 'REMA 1000 AS' }),
      [place('Rema 1000'), place('Rema 1000')],
      '2 places at Grønlandsleiret 9, 0190 are named like "REMA 1000 AS"',
    ],
  ])('does not match %#', (input, candidates, reason) => {
    expect(matcher.match(input, candidates)).toEqual({ kind: 'unmatched', reason });
  });
});
