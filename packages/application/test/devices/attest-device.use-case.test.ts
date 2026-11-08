import { AttestDeviceUseCase, IssueAttestationChallengeUseCase } from '@amexbutikker/application';
import { NotFoundError, RateLimitedError, ValidationError } from '@amexbutikker/contracts';
import type {
  AppAttestInput,
  AppAttestValidator,
  AttestationChallengeService,
  Clock,
  TurnstileValidator,
  UserId,
} from '@amexbutikker/contracts';
import { TestData } from '@amexbutikker/contracts/test-kit';
import {
  EmptyInMemoryTablesFactory,
  InMemoryDeviceRepository,
  InMemoryRateLimiter,
} from '@amexbutikker/in-memory';
import { describe, expect, it } from 'vitest';

const T0 = new Date('2026-11-08T12:00:00.000Z');

class FixedClock implements Clock {
  public now(): Date {
    return T0;
  }
}

/** Challenges are `for:<userId>`; anything else is refused. */
class PlainChallenges implements AttestationChallengeService {
  public issue(userId: UserId): string {
    return `for:${userId}`;
  }

  public verify(userId: UserId, challenge: string): void {
    if (challenge !== `for:${userId}`) {
      throw new ValidationError('bad challenge');
    }
  }
}

class RecordingAppAttest implements AppAttestValidator {
  public readonly inputs: AppAttestInput[] = [];

  public constructor(private readonly accept = true) {}

  public validate(input: AppAttestInput): Promise<void> {
    this.inputs.push(input);
    return this.accept ? Promise.resolve() : Promise.reject(new ValidationError('no'));
  }
}

class RecordingTurnstile implements TurnstileValidator {
  public readonly tokens: string[] = [];

  public constructor(private readonly accept = true) {}

  public validate(token: string): Promise<void> {
    this.tokens.push(token);
    return this.accept ? Promise.resolve() : Promise.reject(new ValidationError('no'));
  }
}

async function setup(options: { appAttest?: boolean; turnstile?: boolean; limit?: number } = {}) {
  const tables = new EmptyInMemoryTablesFactory().create();
  const devices = new InMemoryDeviceRepository(tables);
  const appAttest = new RecordingAppAttest(options.appAttest ?? true);
  const turnstile = new RecordingTurnstile(options.turnstile ?? true);
  const clock = new FixedClock();
  const useCase = new AttestDeviceUseCase(
    devices,
    new PlainChallenges(),
    appAttest,
    turnstile,
    clock,
    new InMemoryRateLimiter(
      { attest_device: { limit: options.limit ?? 10, windowSeconds: 3600 } },
      clock,
    ),
  );
  const userId = new TestData().userId();
  await devices.create({ userId, platform: 'ios', createdAt: T0 });
  return { devices, appAttest, turnstile, useCase, userId };
}

describe('AttestDeviceUseCase', () => {
  it('attests an iPhone with App Attest against its own challenge', async () => {
    const { devices, appAttest, useCase, userId } = await setup();
    const proof = {
      kind: 'app_attest',
      keyId: 'a2V5',
      attestationObject: 'b2Jq',
      challenge: `for:${userId}`,
    } as const;

    await expect(useCase.execute({ userId, proof })).resolves.toEqual({ kind: 'app_attest' });
    expect(appAttest.inputs).toEqual([proof]);
    await expect(devices.findAttestation(userId)).resolves.toEqual({
      kind: 'app_attest',
      attestedAt: T0,
      keyId: 'a2V5',
    });
  });

  it('refuses a challenge issued to another device before asking Apple', async () => {
    const { appAttest, useCase, userId } = await setup();

    await expect(
      useCase.execute({
        userId,
        proof: { kind: 'app_attest', keyId: 'a2V5', attestationObject: 'b2Jq', challenge: 'for:x' },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(appAttest.inputs).toEqual([]);
  });

  it('refuses an attestation Apple does not vouch for', async () => {
    const { devices, useCase, userId } = await setup({ appAttest: false });

    await expect(
      useCase.execute({
        userId,
        proof: {
          kind: 'app_attest',
          keyId: 'a2V5',
          attestationObject: 'b2Jq',
          challenge: `for:${userId}`,
        },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(devices.findAttestation(userId)).resolves.toBeNull();
  });

  it('attests a browser with Turnstile', async () => {
    const { devices, turnstile, useCase, userId } = await setup();

    await expect(
      useCase.execute({ userId, proof: { kind: 'turnstile', token: 'tok' } }),
    ).resolves.toEqual({ kind: 'turnstile' });
    expect(turnstile.tokens).toEqual(['tok']);
    await expect(devices.findAttestation(userId)).resolves.toMatchObject({
      kind: 'turnstile',
      keyId: null,
    });
  });

  it('stores nothing when the Turnstile token is refused', async () => {
    const { devices, useCase, userId } = await setup({ turnstile: false });

    await expect(
      useCase.execute({ userId, proof: { kind: 'turnstile', token: 'tok' } }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(devices.findAttestation(userId)).resolves.toBeNull();
  });

  it('needs a registered device', async () => {
    const { useCase } = await setup();

    await expect(
      useCase.execute({
        userId: new TestData().userId(),
        proof: { kind: 'turnstile', token: 't' },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('limits attempts per device', async () => {
    const { useCase, userId } = await setup({ limit: 1, turnstile: false });
    const attempt = () => useCase.execute({ userId, proof: { kind: 'turnstile', token: 't' } });

    await expect(attempt()).rejects.toBeInstanceOf(ValidationError);
    await expect(attempt()).rejects.toBeInstanceOf(RateLimitedError);
  });
});

describe('IssueAttestationChallengeUseCase', () => {
  it('issues a challenge for the device', async () => {
    const userId = new TestData().userId();

    await expect(
      new IssueAttestationChallengeUseCase(new PlainChallenges()).execute({ userId }),
    ).resolves.toEqual({ challenge: `for:${userId}` });
  });
});
