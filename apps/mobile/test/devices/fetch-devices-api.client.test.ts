import { describe, expect, it } from 'vitest';
import { FetchDevicesApiClient } from '../../src/devices/fetch-devices-api.client';
import { RecordingTransport } from '../shared/recording.transport';

describe('FetchDevicesApiClient', () => {
  it('registers the device with its platform', async () => {
    const transport = new RecordingTransport().answer({
      userId: '0190a000-0000-7000-8000-0000000000aa',
      token: 'abc',
    });

    await expect(new FetchDevicesApiClient(transport).register('android')).resolves.toMatchObject({
      token: 'abc',
    });
    expect(transport.requests).toEqual([
      { method: 'POST', path: '/v1/devices', body: { platform: 'android' } },
    ]);
  });

  it('asks for a challenge with the device token', async () => {
    const transport = new RecordingTransport().answer({ challenge: 'c1.1.a.b' });

    await expect(new FetchDevicesApiClient(transport).challenge('tok')).resolves.toBe('c1.1.a.b');
    expect(transport.requests).toEqual([
      { method: 'POST', path: '/v1/devices/me/challenge', token: 'tok' },
    ]);
  });

  it('sends an attestation with the device token', async () => {
    const transport = new RecordingTransport().answer({ kind: 'turnstile' });

    await expect(
      new FetchDevicesApiClient(transport).attest('tok', { kind: 'turnstile', token: 't' }),
    ).resolves.toEqual({ kind: 'turnstile' });
    expect(transport.requests).toEqual([
      {
        method: 'POST',
        path: '/v1/devices/me/attestation',
        body: { kind: 'turnstile', token: 't' },
        token: 'tok',
      },
    ]);
  });
});
