import { UnauthenticatedError } from '@amexbutikker/contracts';
import { TestData } from '@amexbutikker/contracts/test-kit';
import { describe, expect, it } from 'vitest';
import { HmacDeviceTokenService } from '../../src/devices/infrastructure/hmac-device-token-service.js';

const SECRET = 'a-device-token-secret-of-at-least-32-bytes';

describe('HmacDeviceTokenService', () => {
  let now = new Date('2026-01-01T00:00:00Z');
  const clock = { now: () => now };
  const service = new HmacDeviceTokenService(SECRET, clock, 30);
  const userId = new TestData().userId();

  it('verifies the tokens it issues', async () => {
    const { token } = await service.issue(userId);

    await expect(service.verify(token)).resolves.toBe(userId);
  });

  it('rejects a tampered payload', async () => {
    const { token } = await service.issue(userId);
    const [version, , signature] = token.split('.');
    const otherPayload = Buffer.from(
      JSON.stringify({ sub: new TestData().userId(), iat: 1 }),
    ).toString('base64url');

    await expect(
      service.verify(`${version ?? ''}.${otherPayload}.${signature ?? ''}`),
    ).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it('rejects tokens signed with another secret', async () => {
    const other = new HmacDeviceTokenService(`${SECRET}-other`, clock);
    const { token } = await other.issue(userId);

    await expect(service.verify(token)).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it.each(['', 'v1', 'v1.abc', 'v2.abc.def', 'v1.a.b.c', 'v1.!!!.???'])(
    'rejects malformed token %j',
    async (token) => {
      await expect(service.verify(token)).rejects.toBeInstanceOf(UnauthenticatedError);
    },
  );

  it('rejects expired tokens', async () => {
    const { token } = await service.issue(userId);
    now = new Date('2026-03-01T00:00:00Z');

    await expect(service.verify(token)).rejects.toThrow(/expired/);
    now = new Date('2026-01-01T00:00:00Z');
  });

  it('refuses a short secret', () => {
    expect(() => new HmacDeviceTokenService('short', clock)).toThrow(/32 bytes/);
  });
});
