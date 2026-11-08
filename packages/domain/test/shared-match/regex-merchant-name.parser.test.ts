import { describe, expect, it } from 'vitest';
import { RegexMerchantNameParser } from '../../src/index.js';

describe('RegexMerchantNameParser', () => {
  const parser = new RegexMerchantNameParser();

  it('keeps a clean merchant name as it is', () => {
    expect(parser.parse('Kaffebrenneriet')).toBe('Kaffebrenneriet');
  });

  it.each([
    ['SQ *KAFFEBRENNERIET', 'KAFFEBRENNERIET'],
    ['SumUp  *  Bakeriet på hjørnet', 'Bakeriet på hjørnet'],
    ['Zettle_*Fiskeriet Youngstorget', 'Fiskeriet Youngstorget'],
    ['IZ *Tim Wendelboe', 'Tim Wendelboe'],
    ['PAYPAL *NETFLIX', 'NETFLIX'],
  ])('drops the payment processor prefix of %s', (merchant, name) => {
    expect(parser.parse(merchant)).toBe(name);
  });

  it.each([
    ['Espresso House Norge AS', 'Espresso House Norge'],
    ['Norgesgruppen ASA', 'Norgesgruppen'],
    ['Joe & The Juice Norway NUF', 'Joe & The Juice Norway'],
    ['Kafé Asylet A/S', 'Kafé Asylet'],
  ])('drops the company suffix of %s', (merchant, name) => {
    expect(parser.parse(merchant)).toBe(name);
  });

  it('keeps a short number that is part of the name', () => {
    expect(parser.parse('REMA 1000 MAJORSTUEN')).toBe('REMA 1000 MAJORSTUEN');
    expect(parser.parse('7-Eleven Jernbanetorget')).toBe('7-Eleven Jernbanetorget');
  });

  it('drops reference numbers and terminal ids', () => {
    expect(parser.parse('KIWI 512 BISLETT 4410023 #12')).toBe('KIWI 512 BISLETT');
  });

  it('collapses whitespace and trims punctuation at the ends', () => {
    expect(parser.parse('  Vinmonopolet ,  Oslo City - ')).toBe('Vinmonopolet , Oslo City');
  });

  it.each(['', '   ', 'SQ *', '***', '4410023', 'AS'])(
    'is null when nothing is left of %j',
    (merchant) => {
      expect(parser.parse(merchant)).toBeNull();
    },
  );
});
