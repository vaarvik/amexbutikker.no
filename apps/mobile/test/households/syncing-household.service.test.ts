import { ValidationError } from '@amexbutikker/contracts';
import { describe, expect, it } from 'vitest';
import { KeyValueHouseholdStorage } from '../../src/households/key-value-household.storage';
import { SyncingHouseholdService } from '../../src/households/syncing-household.service';
import { UrlHouseholdInviteTranslator } from '../../src/households/url-household-invite.translator';
import { XchachaHouseholdCipher } from '../../src/households/xchacha-household.cipher';
import { ApiError } from '../../src/shared/fetch-json.transport';
import { ForwardingSpendingChangeNotifier } from '../../src/spending/forwarding-spending-change.notifier';
import { KeyValueSpendingStorage } from '../../src/spending/key-value-spending.storage';
import { ReplayingSpendingStateCalculator } from '../../src/spending/replaying-spending-state.calculator';
import type { Card, HouseholdId } from '@amexbutikker/contracts';
import { MapKeyValueStorage } from '../shared/mobile-test.data';
import {
  FixedClock,
  FixedLocalDateProvider,
  spendingService,
} from '../spending/spending-test.data';
import { FakeHouseholdServer, NodeRandomBytes } from './household-test.data';

const PREMIUM: Card = {
  id: 'premium',
  name: 'SAS Amex Premium',
  shortName: 'SAS Premium',
  goals: [
    { title: 'Kupong', targetNok: 150_000, period: { kind: 'calendar_year' }, reward: '2-for-1' },
  ],
  sourceUrl: null,
  fetchedAt: '2026-11-08',
};

/** One phone: its own spending and household storage, talking to the shared fake server. */
function phone(server: FakeHouseholdServer, name: string, batchSize = 50) {
  const spendingStorage = new KeyValueSpendingStorage(new MapKeyValueStorage(), { key: 's' });
  const notifier = new ForwardingSpendingChangeNotifier();
  const spending = spendingService(
    spendingStorage,
    new FixedLocalDateProvider('2026-11-07'),
    notifier,
  );
  const storage = new KeyValueHouseholdStorage(new MapKeyValueStorage(), new MapKeyValueStorage(), {
    key: 'h',
  });
  const households = new SyncingHouseholdService(
    server.as(name),
    new XchachaHouseholdCipher(new NodeRandomBytes()),
    new UrlHouseholdInviteTranslator({ webOrigin: null }),
    storage,
    spendingStorage,
    new ReplayingSpendingStateCalculator(),
    spending,
    new FixedClock(),
    { batchSize },
  );
  notifier.attach(households);
  return { spending, households, storage };
}

async function linkOf(households: SyncingHouseholdService): Promise<string> {
  const status = await households.status();
  if (status.kind !== 'member') {
    throw new Error('Not in a household.');
  }
  return status.inviteLink;
}

describe('SyncingHouseholdService', () => {
  it('is alone until it creates a household, and shares what Bonus already had', async () => {
    const server = new FakeHouseholdServer();
    const a = phone(server, 'a');
    await a.spending.addPurchase({ date: '2026-11-01', amountNok: 1_000 });

    await expect(a.households.status()).resolves.toEqual({ kind: 'alone' });
    await expect(a.households.sync()).resolves.toEqual({ kind: 'alone' });
    const created = await a.households.create();

    expect(created).toMatchObject({ kind: 'member', memberCount: 1 });
    expect(server.records).toHaveLength(1);
    expect(server.records[0]?.sealed).not.toContain('1000');
    await expect(a.households.create()).resolves.toEqual(await a.households.status());
  });

  it('gives both phones the same Bonus, with the household card winning on join', async () => {
    const server = new FakeHouseholdServer();
    const a = phone(server, 'a');
    const b = phone(server, 'b');
    await a.spending.setCard(PREMIUM);
    await a.spending.addPurchase({ date: '2026-11-01', amountNok: 1_000 });
    await a.households.create();
    await b.spending.setCard(null);
    await b.spending.addPurchase({ date: '2026-11-02', amountNok: 250 });

    const joined = await b.households.join(await linkOf(a.households));
    await a.households.sync();

    expect(joined).toMatchObject({ kind: 'member', memberCount: 2 });
    for (const each of [a, b]) {
      const overview = await each.spending.overview();
      expect(overview.card?.id).toBe('premium');
      expect(overview.year.spentNok).toBe(1_250);
      expect(overview.progress.map((progress) => progress.spentNok)).toEqual([1_250]);
    }

    // A change on one phone reaches the other; a removal too.
    const bought = await b.spending.recordPurchase({ date: '2026-11-03', amountNok: 50 });
    await b.households.sync();
    await a.households.sync();
    expect((await a.spending.overview()).year.spentNok).toBe(1_300);
    await a.spending.removeEntry(bought.id);
    await a.households.sync();
    await b.households.sync();
    expect((await b.spending.overview()).year.spentNok).toBe(1_250);
  });

  it('queues changes while offline and sends them in batches later', async () => {
    const server = new FakeHouseholdServer();
    const a = phone(server, 'a', 2);
    await a.households.create();
    server.offline = true;

    for (const amount of [1, 2, 3]) {
      await a.spending.addPurchase({ date: '2026-11-01', amountNok: amount });
    }
    await expect(a.households.sync()).resolves.toEqual({ kind: 'offline' });
    expect((await a.storage.find())?.pending).toHaveLength(3);

    server.offline = false;
    await expect(a.households.sync()).resolves.toMatchObject({ kind: 'synced', sent: 3 });
    expect(server.records).toHaveLength(3);
    expect((await a.storage.find())?.pending).toEqual([]);
  });

  it('reads many pages and skips records it cannot open', async () => {
    const server = new FakeHouseholdServer();
    const a = phone(server, 'a');
    const b = phone(server, 'b');
    await a.households.create();
    await b.households.join(await linkOf(a.households));
    for (const amount of [1, 2, 3]) {
      await a.spending.addPurchase({ date: '2026-11-01', amountNok: amount });
    }
    await a.households.sync();
    server.records.push({ seq: server.records.length + 1, author: 'x', sealed: 'AAAAAAAA' });
    server.pageSize = 1;

    await expect(b.households.sync()).resolves.toMatchObject({ kind: 'synced', received: 3 });
    expect((await b.spending.overview()).year.spentNok).toBe(6);
    expect((await b.storage.find())?.cursor).toBe(server.records.length);
  });

  it('forgets a household the server no longer has it in', async () => {
    const server = new FakeHouseholdServer();
    const a = phone(server, 'a');
    await a.households.create();
    server.members.clear();

    await expect(a.households.sync()).resolves.toEqual({ kind: 'gone' });
    await expect(a.households.status()).resolves.toEqual({ kind: 'alone' });
  });

  it('forgets the household when a request answers 404 mid-sync', async () => {
    const server = new FakeHouseholdServer();
    const a = phone(server, 'a');
    await a.households.create();
    const api = server.as('a');
    api.append = () => Promise.reject(new ApiError('not_found', 404, 'gone'));
    const broken = new SyncingHouseholdService(
      api,
      new XchachaHouseholdCipher(new NodeRandomBytes()),
      new UrlHouseholdInviteTranslator({ webOrigin: null }),
      a.storage,
      new KeyValueSpendingStorage(new MapKeyValueStorage(), { key: 's' }),
      new ReplayingSpendingStateCalculator(),
      a.spending,
      new FixedClock(),
      { batchSize: 50 },
    );
    await broken.changed([
      { id: 'c', at: '2026-11-08T12:00:00.000Z', kind: 'entry_removed', entryId: 'p' },
    ]);

    await expect(broken.sync()).resolves.toEqual({ kind: 'gone' });
  });

  it('leaves, keeping its copy, and leaves cleanly when the server already let it go', async () => {
    const server = new FakeHouseholdServer();
    const a = phone(server, 'a');
    await a.spending.addPurchase({ date: '2026-11-01', amountNok: 70 });
    await a.households.create();

    await expect(a.households.leave()).resolves.toEqual({ kind: 'alone' });
    expect(server.members.size).toBe(0);
    expect((await a.spending.overview()).year.spentNok).toBe(70);
    await expect(a.households.leave()).resolves.toEqual({ kind: 'alone' });

    await a.households.create();
    server.members.clear();
    await expect(a.households.leave()).resolves.toEqual({ kind: 'alone' });
  });

  it('keeps the household when leaving fails offline', async () => {
    const server = new FakeHouseholdServer();
    const a = phone(server, 'a');
    await a.households.create();
    server.offline = true;

    await expect(a.households.leave()).rejects.toMatchObject({ code: 'unreachable' });
    await expect(a.households.status()).resolves.toMatchObject({ kind: 'member' });
  });

  it('refuses a link that is not an invite, and moves to another household on a new one', async () => {
    const server = new FakeHouseholdServer();
    const a = phone(server, 'a');
    const b = phone(server, 'b');
    await a.households.create();
    const link = await linkOf(a.households);

    await expect(b.households.join('https://example.no')).rejects.toBeInstanceOf(ValidationError);
    await b.households.join(link);
    await expect(b.households.join(link)).resolves.toMatchObject({ memberCount: 2 });

    // Another household's invite (same key, so the fake accepts it): b leaves first, then joins.
    const invite = new UrlHouseholdInviteTranslator({ webOrigin: null }).fromLink(link);
    const otherId = '0190a000-0000-7000-8000-0000000000bb' as HouseholdId;
    const otherLink = new UrlHouseholdInviteTranslator({ webOrigin: null }).toLink({
      householdId: otherId,
      key: invite?.key ?? '',
    });
    await b.households.join(otherLink);
    expect((await b.storage.find())?.invite.householdId).toBe(otherId);
  });

  it('ignores changes while in no household', async () => {
    const server = new FakeHouseholdServer();
    const a = phone(server, 'a');

    await a.spending.addPurchase({ date: '2026-11-01', amountNok: 5 });

    expect(server.records).toEqual([]);
    await expect(a.storage.find()).resolves.toBeNull();
  });

  it('leaves a household it lost the key to, then creates or joins anew', async () => {
    const server = new FakeHouseholdServer();
    const a = phone(server, 'a');
    await a.households.create();
    // The old web bug: the key is gone from this phone, the membership is not.
    await a.storage.save(null);
    server.members.add('a');

    await expect(a.households.create()).resolves.toMatchObject({ kind: 'member' });

    const b = phone(server, 'b');
    server.members.add('b');
    await expect(b.households.join(await linkOf(a.households))).resolves.toMatchObject({
      kind: 'member',
    });
  });
});
