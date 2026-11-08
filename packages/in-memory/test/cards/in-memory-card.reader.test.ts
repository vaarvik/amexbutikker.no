import { describeCardReaderContract } from '@amexbutikker/contracts/test-kit';
import { InMemoryCardReader } from '../../src/cards/in-memory-card.reader.js';

describeCardReaderContract('InMemoryCardReader', () =>
  Promise.resolve({
    reader: new InMemoryCardReader([
      {
        id: 'test-card',
        name: 'Test Card',
        shortName: 'Test',
        goals: [
          {
            title: 'Bonus',
            targetNok: 100_000,
            period: { kind: 'calendar_year' },
            reward: 'A voucher',
          },
        ],
        sourceUrl: 'https://example.no/terms',
        fetchedAt: '2026-11-08',
      },
      {
        id: 'plain-card',
        name: 'Plain Card',
        shortName: 'Plain',
        goals: [],
        sourceUrl: null,
        fetchedAt: '2026-11-08',
      },
    ]),
  }),
);
