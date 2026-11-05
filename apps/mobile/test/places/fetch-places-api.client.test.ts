import { beforeEach, describe, expect, it } from 'vitest';
import type { DeviceSession } from '../../src/devices/devices.ports';
import { FetchPlacesApiClient } from '../../src/places/fetch-places-api.client';
import { ApiError } from '../../src/shared/fetch-json.transport';
import { details, PLACE_ID, physicalPlace, summary } from '../shared/mobile-test.data';
import { RecordingTransport } from '../shared/recording.transport';

class FakeSession implements DeviceSession {
  public token: string | null = null;
  public registrations = 0;
  public resets = 0;

  public findToken(): Promise<string | null> {
    return Promise.resolve(this.token);
  }

  public getToken(): Promise<string> {
    if (this.token === null) {
      this.registrations += 1;
      this.token = `token-${String(this.registrations)}`;
    }
    return Promise.resolve(this.token);
  }

  public reset(): Promise<void> {
    this.resets += 1;
    this.token = null;
    return Promise.resolve();
  }
}

const statusChange = { status: summary().status, chainHint: null };
const unauthorized = () => new ApiError('unauthorized', 401, 'Invalid token');

describe('FetchPlacesApiClient', () => {
  let transport: RecordingTransport;
  let session: FakeSession;
  let client: FetchPlacesApiClient;

  beforeEach(() => {
    transport = new RecordingTransport();
    session = new FakeSession();
    client = new FetchPlacesApiClient(transport, session);
  });

  it('searches and lists nearby places without a token', async () => {
    transport.answer({ results: [summary()] }, { results: [] });

    await expect(client.search({ q: 'kafé', lat: 59.9, lng: 10.7 })).resolves.toEqual({
      results: [summary()],
    });
    await client.listNearby({ lat: 59.9, lng: 10.7, radiusM: 1500 });

    expect(transport.requests).toEqual([
      { method: 'GET', path: '/v1/places/search', query: { q: 'kafé', lat: 59.9, lng: 10.7 } },
      { method: 'GET', path: '/v1/places/nearby', query: { lat: 59.9, lng: 10.7, radiusM: 1500 } },
    ]);
    expect(session.registrations).toBe(0);
  });

  it('gets details with the token once the device has one, without registering', async () => {
    transport.answer(details(), details());

    await client.getDetails(PLACE_ID);
    session.token = 'stored';
    await client.getDetails(PLACE_ID);

    expect(transport.requests).toEqual([
      { method: 'GET', path: `/v1/places/${PLACE_ID}` },
      { method: 'GET', path: `/v1/places/${PLACE_ID}`, token: 'stored' },
    ]);
    expect(session.registrations).toBe(0);
  });

  it('registers before the first write and sends the token with every write', async () => {
    transport.answer({ place: physicalPlace() }, statusChange, statusChange);

    await client.create({ kind: 'online', name: 'Nettbutikken', website: 'https://example.no' });
    await client.submitReport(PLACE_ID, { result: 'accepted' });
    await client.removeMyReport(PLACE_ID);

    expect(transport.requests).toEqual([
      {
        method: 'POST',
        path: '/v1/places',
        body: { kind: 'online', name: 'Nettbutikken', website: 'https://example.no' },
        token: 'token-1',
      },
      {
        method: 'POST',
        path: `/v1/places/${PLACE_ID}/reports`,
        body: { result: 'accepted' },
        token: 'token-1',
      },
      { method: 'DELETE', path: `/v1/places/${PLACE_ID}/reports/me`, token: 'token-1' },
    ]);
    expect(session.registrations).toBe(1);
  });

  it('drops a rejected token, registers again and retries once', async () => {
    session.token = 'revoked';
    transport.answer(unauthorized(), statusChange);

    await expect(client.submitReport(PLACE_ID, { result: 'rejected' })).resolves.toEqual(
      statusChange,
    );

    expect(session.resets).toBe(1);
    expect(transport.requests.map((request) => request.token)).toEqual(['revoked', 'token-1']);
  });

  it('gives up when the retried request is rejected too', async () => {
    transport.answer(unauthorized(), unauthorized());

    await expect(client.removeMyReport(PLACE_ID)).rejects.toMatchObject({ status: 401 });
    expect(transport.requests).toHaveLength(2);
  });

  it('does not retry other failures', async () => {
    transport.answer(new ApiError('rate_limited', 429, 'Slow down', 30));

    await expect(client.submitReport(PLACE_ID, { result: 'accepted' })).rejects.toMatchObject({
      code: 'rate_limited',
    });
    expect(session.resets).toBe(0);
    expect(transport.requests).toHaveLength(1);
  });

  it('does not retry an error that is not an ApiError', async () => {
    transport.answer(new Error('boom'));

    await expect(client.submitReport(PLACE_ID, { result: 'accepted' })).rejects.toThrow('boom');
    expect(session.resets).toBe(0);
  });
});
