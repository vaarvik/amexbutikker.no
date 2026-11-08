import { describe, expect, it } from 'vitest';
import type { DeviceSession } from '../../src/devices/devices.ports';
import { FetchHouseholdsApiClient } from '../../src/households/fetch-households-api.client';
import { ApiError } from '../../src/shared/fetch-json.transport';
import { RecordingTransport } from '../shared/recording.transport';
import { HOUSEHOLD_ID } from './household-test.data';

class FixedSession implements DeviceSession {
  public findToken(): Promise<string | null> {
    return Promise.resolve('tok');
  }

  public getToken(): Promise<string> {
    return Promise.resolve('tok');
  }

  public reset(): Promise<void> {
    return Promise.resolve();
  }
}

const SUMMARY = { householdId: HOUSEHOLD_ID, memberCount: 2 };

function setup() {
  const transport = new RecordingTransport();
  return { transport, client: new FetchHouseholdsApiClient(transport, new FixedSession()) };
}

describe('FetchHouseholdsApiClient', () => {
  it('creates and joins with the join token and the device token', async () => {
    const { transport, client } = setup();
    transport.answer(SUMMARY, SUMMARY);

    await expect(client.create('jt')).resolves.toEqual(SUMMARY);
    await expect(client.join(HOUSEHOLD_ID, 'jt')).resolves.toEqual(SUMMARY);

    expect(transport.requests).toEqual([
      { method: 'POST', path: '/v1/households', body: { joinToken: 'jt' }, token: 'tok' },
      {
        method: 'POST',
        path: `/v1/households/${HOUSEHOLD_ID}/members`,
        body: { joinToken: 'jt' },
        token: 'tok',
      },
    ]);
  });

  it('finds the household, or none on 404, and passes other errors on', async () => {
    const { transport, client } = setup();
    transport.answer(
      SUMMARY,
      new ApiError('not_found', 404, 'none'),
      new ApiError('unreachable', null, 'offline'),
    );

    await expect(client.find()).resolves.toEqual(SUMMARY);
    await expect(client.find()).resolves.toBeNull();
    await expect(client.find()).rejects.toMatchObject({ code: 'unreachable' });
  });

  it('leaves, appends sealed records and lists them after a cursor', async () => {
    const { transport, client } = setup();
    transport.answer(undefined, { seqs: [7, 8] }, { records: [], hasMore: false });

    await client.leave();
    await expect(client.append(['a', 'b'])).resolves.toEqual({ seqs: [7, 8] });
    await expect(client.list(6)).resolves.toEqual({ records: [], hasMore: false });

    expect(transport.requests).toEqual([
      { method: 'DELETE', path: '/v1/households/me', token: 'tok' },
      {
        method: 'POST',
        path: '/v1/households/me/records',
        body: { records: [{ sealed: 'a' }, { sealed: 'b' }] },
        token: 'tok',
      },
      { method: 'GET', path: '/v1/households/me/records', query: { after: 6 }, token: 'tok' },
    ]);
  });
});
