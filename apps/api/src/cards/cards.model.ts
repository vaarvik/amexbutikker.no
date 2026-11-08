import type { Card } from '@amexbutikker/contracts';

const LISTEN = 'https://www.kredittkortlisten.no/american-express/';
const ELITE = 'https://kortio.no/kort/sas-amex-elite/';

/**
 * American Express cards issued in Norway, as listed by kredittkortlisten.no on 2026-11-08, with
 * the yearly spending goals checked sources give. Cards without a checked goal have none: the
 * user adds their own. Change it here and deploy the API; the app needs no new version.
 */
export const CARD_CATALOGUE: readonly Card[] = [
  {
    id: 'sas-eurobonus-amex-classic',
    name: 'SAS EuroBonus American Express Classic',
    shortName: 'SAS Amex Classic',
    goals: [
      {
        title: '2-for-1-kupong',
        targetNok: 100_000,
        period: { kind: 'calendar_year' },
        reward: 'En 2-for-1-kupong hos SAS',
      },
    ],
    sourceUrl: LISTEN,
    fetchedAt: '2026-11-08',
  },
  {
    id: 'sas-eurobonus-amex-premium',
    name: 'SAS EuroBonus American Express Premium',
    shortName: 'SAS Amex Premium',
    goals: [
      {
        title: '2-for-1-kupong',
        targetNok: 150_000,
        period: { kind: 'calendar_year' },
        reward: 'En 2-for-1-kupong hos SAS',
      },
    ],
    sourceUrl: LISTEN,
    fetchedAt: '2026-11-08',
  },
  {
    id: 'sas-eurobonus-amex-elite',
    name: 'SAS EuroBonus American Express Elite',
    shortName: 'SAS Amex Elite',
    goals: [
      {
        title: 'Companion Ticket',
        targetNok: 150_000,
        period: { kind: 'calendar_year' },
        reward: 'Én Companion Ticket hos SAS',
      },
      {
        title: 'To Companion Tickets',
        targetNok: 300_000,
        period: { kind: 'calendar_year' },
        reward: 'To reiser på 2-for-1 samme år',
      },
    ],
    sourceUrl: ELITE,
    fetchedAt: '2026-11-08',
  },
  ...(
    [
      ['amex-green', 'American Express Green Card', 'Amex Green'],
      ['amex-gold', 'American Express Gold Card', 'Amex Gold'],
      ['amex-platinum', 'American Express Platinum Card', 'Amex Platinum'],
      [
        'amex-platinum-points-plus',
        'American Express Platinum Points Plus',
        'Platinum Points Plus',
      ],
      ['amex-centurion', 'American Express Centurion', 'Amex Centurion'],
    ] as const
  ).map(([id, name, shortName]): Card => ({
    id,
    name,
    shortName,
    goals: [],
    sourceUrl: null,
    fetchedAt: '2026-11-08',
  })),
];
