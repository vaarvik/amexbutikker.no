import { ValidationError } from '@amexbutikker/contracts';
import type { Passkey, PasskeyCredential } from '@amexbutikker/contracts';
import { PasskeyIdSchema } from '@amexbutikker/contracts';
import { describe, expect, it } from 'vitest';
import { WebAuthnPasskeyService } from '../../src/access/web-authn-passkey.service.js';

const service = new WebAuthnPasskeyService({
  origin: 'https://amex.example.test',
  rpName: 'Tar de Amex?',
});
const CHALLENGE = Buffer.from('a challenge of some length').toString('base64url');

function credential(
  clientData: unknown,
  response: Record<string, unknown> = {},
): PasskeyCredential {
  const clientDataJSON = Buffer.from(JSON.stringify(clientData)).toString('base64url');
  return {
    id: 'Y3JlZA',
    rawId: 'Y3JlZA',
    type: 'public-key',
    clientExtensionResults: {},
    response: { clientDataJSON, ...response },
  };
}

const stored: Passkey = {
  id: PasskeyIdSchema.parse('Y3JlZA'),
  publicKey: 'cGs',
  counter: 0,
  transports: ['internal'],
  createdAt: new Date('2026-11-19T12:00:00.000Z'),
};

describe('WebAuthnPasskeyService', () => {
  it('asks for a discoverable passkey on the site host, with the given challenge', async () => {
    const options = await service.registrationOptions(CHALLENGE);

    expect(options).toMatchObject({
      challenge: CHALLENGE,
      rp: { id: 'amex.example.test', name: 'Tar de Amex?' },
      attestation: 'none',
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    });
  });

  it('signs in with any passkey for the site', async () => {
    const options = await service.signInOptions(CHALLENGE);

    expect(options).toMatchObject({
      challenge: CHALLENGE,
      rpId: 'amex.example.test',
      userVerification: 'required',
    });
    expect(options).not.toHaveProperty('allowCredentials.0');
  });

  it('reads the challenge and the passkey id from a credential', () => {
    const sent = credential({ type: 'webauthn.get', challenge: CHALLENGE });

    expect(service.challengeOf(sent)).toBe(CHALLENGE);
    expect(service.passkeyIdOf(sent)).toBe('Y3JlZA');
  });

  it('refuses malformed credentials and client data', () => {
    expect(() => service.challengeOf({ id: 'x' })).toThrow(ValidationError);
    expect(() =>
      service.challengeOf({ ...credential({}), response: { clientDataJSON: 'bm90LWpzb24' } }),
    ).toThrow('client data');
    expect(() => service.challengeOf(credential({ type: 'webauthn.get' }))).toThrow('client data');
  });

  it('refuses a registration that does not check out', async () => {
    const sent = credential(
      { type: 'webauthn.create', challenge: CHALLENGE, origin: 'https://evil.example.test' },
      { attestationObject: 'AAAA' },
    );

    await expect(service.verifyRegistration(sent, CHALLENGE)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('refuses a sign-in that does not check out', async () => {
    const sent = credential(
      { type: 'webauthn.get', challenge: CHALLENGE, origin: 'https://amex.example.test' },
      { authenticatorData: 'AAAA', signature: 'AAAA' },
    );

    await expect(service.verifySignIn(sent, CHALLENGE, stored)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});
