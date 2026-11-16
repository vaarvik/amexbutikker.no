import type { FastifyRequest } from 'fastify';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { JwksAccessAuthenticator } from '../../src/shared/jwks-access.authenticator.js';

const ISSUER = 'https://team.cloudflareaccess.com';
const AUDIENCE = 'aud-tag';

type Keys = Awaited<ReturnType<typeof generateKeyPair>>;

function request(headers: Record<string, string>): FastifyRequest {
  return { headers } as unknown as FastifyRequest;
}

describe('JwksAccessAuthenticator', () => {
  let keys: Keys;
  let other: Keys;
  let authenticator: JwksAccessAuthenticator;

  const token = (
    claims: { iss?: string; aud?: string; exp?: string } = {},
    signer: Keys = keys,
  ): Promise<string> =>
    new SignJWT({ email: 'a@example.com' })
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer(claims.iss ?? ISSUER)
      .setAudience(claims.aud ?? AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(claims.exp ?? '1h')
      .sign(signer.privateKey);

  beforeAll(async () => {
    keys = await generateKeyPair('RS256');
    other = await generateKeyPair('RS256');
    const jwk = { ...(await exportJWK(keys.publicKey)), kid: 'k1', alg: 'RS256' };
    authenticator = new JwksAccessAuthenticator(createLocalJWKSet({ keys: [jwk] }), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
  });

  it('lets in a valid login from the header or the cookie', async () => {
    const jwt = await token();

    await expect(
      authenticator.requireAccess(request({ 'cf-access-jwt-assertion': jwt })),
    ).resolves.toBeUndefined();
    await expect(
      authenticator.requireAccess(request({ cookie: `a=b; CF_Authorization=${jwt}; c=d` })),
    ).resolves.toBeUndefined();
  });

  it('refuses a request without a login', async () => {
    await expect(authenticator.requireAccess(request({}))).rejects.toMatchObject({
      code: 'unauthenticated',
    });
    await expect(
      authenticator.requireAccess(request({ cookie: 'CF_Authorization=' })),
    ).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it.each([
    ['another issuer', { iss: 'https://evil.cloudflareaccess.com' }],
    ['another audience', { aud: 'other-app' }],
    ['an expired login', { exp: '-1m' }],
  ])('refuses %s', async (_name, claims) => {
    const jwt = await token(claims);

    await expect(
      authenticator.requireAccess(request({ 'cf-access-jwt-assertion': jwt })),
    ).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('refuses a login signed with another key', async () => {
    const jwt = await token({}, other);

    await expect(
      authenticator.requireAccess(request({ 'cf-access-jwt-assertion': jwt })),
    ).rejects.toMatchObject({ code: 'unauthenticated' });
  });
});
