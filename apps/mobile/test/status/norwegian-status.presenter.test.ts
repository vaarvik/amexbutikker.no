import { describe, expect, it } from 'vitest';
import { ApiError } from '../../src/shared/fetch-json.transport';
import { NorwegianStatusPresenter } from '../../src/status/norwegian-status.presenter';
import { CHAIN_ID, details, physicalPlace } from '../shared/mobile-test.data';

const presenter = new NorwegianStatusPresenter();
// Noon UTC, so the date is the same in every time zone the tests may run in.
const observedAt = '2026-11-03T12:00:00.000Z';

describe('NorwegianStatusPresenter', () => {
  it.each([
    ['accepted', 'Ja', '✓'],
    ['rejected', 'Nei', '✕'],
    ['mixed', 'Varierer', '±'],
    ['unknown', 'Ukjent', '?'],
  ] as const)('shows %s as %s with its own symbol', (status, answer, symbol) => {
    expect(presenter.status(status)).toMatchObject({ status, answer, symbol });
  });

  describe('basis', () => {
    it.each([
      [{ kind: 'transaction' as const }, 'Bekreftet med kjøp 3. nov. 2026.'],
      [{ kind: 'visit_report' as const, observedAt: null }, 'Bekreftet ved besøk.'],
      [
        { kind: 'external_list' as const, source: 'kredittkort360' },
        'Ifølge kredittkort360 (hentet 3. nov. 2026), ikke bekreftet av brukere.',
      ],
      [
        { kind: 'external_list' as const, source: null, observedAt: null },
        'Ifølge en ekstern liste, ikke bekreftet av brukere.',
      ],
      [
        { kind: 'checkout_logo' as const, source: 'Amexvenn' },
        'Amex-logo i kassen ifølge Amexvenn, ikke bekreftet av brukere.',
      ],
      [
        { kind: null, scope: 'none' as const, observedAt: null, userAccepted: 0 },
        'Ingen har rapportert om dette stedet ennå.',
      ],
      [
        { kind: 'user_report' as const, userAccepted: 1, userRejected: 0 },
        'Én bruker har fått betale med Amex her. Sist rapportert 3. nov. 2026.',
      ],
      [
        { kind: 'user_report' as const, userAccepted: 3, userRejected: 1 },
        '3 brukere har fått betale med Amex her, én bruker er blitt avvist. Sist rapportert 3. nov. 2026.',
      ],
      [
        { kind: 'user_report' as const, userAccepted: 0, userRejected: 2, observedAt: null },
        '2 brukere er blitt avvist her.',
      ],
    ])('explains %o', (basis, sentence) => {
      expect(presenter.basis(details({ observedAt, ...basis }))).toBe(sentence);
    });

    it('names the chain for a chain confirmation', () => {
      expect(
        presenter.basis(
          details(
            { kind: 'chain_confirmation', scope: 'chain', source: 'kjedens nettside', observedAt },
            { chain: { id: CHAIN_ID, name: 'Rema 1000' } },
          ),
        ),
      ).toBe(
        'Ifølge kjedens nettside gjelder dette hele Rema 1000. Ikke bekreftet av brukere her.',
      );
      expect(
        presenter.basis(details({ kind: 'chain_confirmation', scope: 'chain', source: null })),
      ).toBe('Ifølge en ekstern liste gjelder dette hele kjeden. Ikke bekreftet av brukere her.');
    });
  });

  it('gives the chain hint only with a chain and chain evidence', () => {
    const chain = { id: CHAIN_ID, name: 'Rema 1000' };
    const hint = (acceptedCount: number, totalWithEvidence: number) => ({
      chainId: CHAIN_ID,
      acceptedCount,
      totalWithEvidence,
    });

    expect(presenter.chainHint(details({}, { chain, chainHint: hint(7, 9) }))).toBe(
      '7 av 9 steder i Rema 1000 tar Amex.',
    );
    expect(presenter.chainHint(details({}, { chain, chainHint: hint(0, 0) }))).toBeNull();
    expect(presenter.chainHint(details({}, { chain, chainHint: null }))).toBeNull();
    expect(presenter.chainHint(details({}, { chain: null, chainHint: hint(1, 1) }))).toBeNull();
  });

  it.each([
    [null, null],
    [3, '10 m'],
    [124, '120 m'],
    [999, '1000 m'],
    [1449, '1,4 km'],
  ])('formats a distance of %s', (metres, text) => {
    expect(presenter.distance(metres)).toBe(text);
  });

  it('formats addresses and online hosts', () => {
    expect(presenter.address(physicalPlace())).toBe('Torggata 5, 0181 Oslo');
    expect(
      presenter.address(physicalPlace({ address: { street: null, postcode: null, city: 'Oslo' } })),
    ).toBe('Oslo');
    expect(
      presenter.address(physicalPlace({ address: { street: null, postcode: null, city: null } })),
    ).toBeNull();
    expect(
      presenter.address({
        kind: 'online',
        id: physicalPlace().id,
        name: 'Nettbutikken',
        category: 'online_shop',
        website: 'https://www.nettbutikken.no/kasse',
      }),
    ).toBe('nettbutikken.no');
    expect(
      presenter.address({
        kind: 'online',
        id: physicalPlace().id,
        name: 'Rar',
        category: 'online_shop',
        website: 'not a url',
      }),
    ).toBe('not a url');
  });

  it('labels categories', () => {
    expect(presenter.category('fast_food')).toBe('Gatekjøkken');
  });

  it.each([
    [
      new ApiError('unreachable', null, 'x'),
      'Får ikke kontakt med serveren. Sjekk nettet og prøv igjen.',
    ],
    [
      new ApiError('rate_limited', 429, 'x'),
      'Du har sendt mange rapporter på kort tid. Prøv igjen om litt.',
    ],
    [new ApiError('internal', 500, 'x'), 'Noe gikk galt. Prøv igjen.'],
    [new Error('x'), 'Noe gikk galt. Prøv igjen.'],
  ])('explains a failure: %o', (error, message) => {
    expect(presenter.error(error)).toBe(message);
  });
});
