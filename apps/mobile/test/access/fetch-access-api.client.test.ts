import { describe, expect, it } from 'vitest';
import { FetchAccessApiClient } from '../../src/access/fetch-access-api.client';
import { RecordingTransport } from '../shared/recording.transport';

describe('FetchAccessApiClient', () => {
  it('renews the session', async () => {
    const transport = new RecordingTransport().answer(undefined);

    await expect(new FetchAccessApiClient(transport).renew()).resolves.toBeUndefined();
    expect(transport.requests).toEqual([{ method: 'POST', path: '/v1/access/session' }]);
  });

  it('asks for registration options with the invite code', async () => {
    const transport = new RecordingTransport().answer({ options: { challenge: 'c' } });

    await expect(
      new FetchAccessApiClient(transport).registrationOptions('invite-1'),
    ).resolves.toEqual({ challenge: 'c' });
    expect(transport.requests).toEqual([
      {
        method: 'POST',
        path: '/v1/access/registration/options',
        body: { inviteCode: 'invite-1' },
      },
    ]);
  });

  it('sends the new passkey', async () => {
    const transport = new RecordingTransport().answer(undefined);

    await new FetchAccessApiClient(transport).register({ id: 'k' });
    expect(transport.requests).toEqual([
      { method: 'POST', path: '/v1/access/registration', body: { credential: { id: 'k' } } },
    ]);
  });

  it('asks for sign-in options and signs in', async () => {
    const transport = new RecordingTransport().answer({ options: { challenge: 's' } }, undefined);
    const client = new FetchAccessApiClient(transport);

    await expect(client.signInOptions()).resolves.toEqual({ challenge: 's' });
    await client.signIn({ id: 'k' });
    expect(transport.requests).toEqual([
      { method: 'POST', path: '/v1/access/sign-in/options' },
      { method: 'POST', path: '/v1/access/sign-in', body: { credential: { id: 'k' } } },
    ]);
  });
});
