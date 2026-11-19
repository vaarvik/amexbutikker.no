import { describe, expect, it, vi } from 'vitest';
import { BrowserPasskeyClient } from '../../src/access/browser-passkey.client';

vi.mock('@simplewebauthn/browser', () => ({
  startRegistration: vi.fn((input: { optionsJSON: { challenge: string } }) =>
    Promise.resolve({ id: `new-${input.optionsJSON.challenge}` }),
  ),
  startAuthentication: vi.fn((input: { optionsJSON: { challenge: string } }) =>
    Promise.resolve({ id: `old-${input.optionsJSON.challenge}` }),
  ),
}));

describe('BrowserPasskeyClient', () => {
  it('creates a passkey from the API options', async () => {
    await expect(new BrowserPasskeyClient().create({ challenge: 'c' })).resolves.toEqual({
      id: 'new-c',
    });
  });

  it('signs with a stored passkey', async () => {
    await expect(new BrowserPasskeyClient().get({ challenge: 's' })).resolves.toEqual({
      id: 'old-s',
    });
  });
});
