import {
  CompletePasskeyRegistrationUseCase,
  CompletePasskeySignInUseCase,
  RenewAccessSessionUseCase,
  StartPasskeyRegistrationUseCase,
  StartPasskeySignInUseCase,
} from '@amexbutikker/application';
import {
  PasskeyIdSchema,
  RateLimitedError,
  UnauthenticatedError,
  ValidationError,
} from '@amexbutikker/contracts';
import type {
  AccessSession,
  AccessSessionService,
  IssuedAccessSession,
  NewPasskey,
  Passkey,
  PasskeyCeremony,
  PasskeyChallengePurpose,
  PasskeyChallengeService,
  PasskeyCredential,
  PasskeyId,
  PasskeyInviteValidator,
  PasskeyOptions,
} from '@amexbutikker/contracts';
import { InMemoryPasskeyRepository, InMemoryRateLimiter } from '@amexbutikker/in-memory';
import { describe, expect, it } from 'vitest';

const T0 = new Date('2026-11-19T12:00:00.000Z');
const clock = { now: () => T0 };
const KEY = PasskeyIdSchema.parse('a2V5');

/** Challenges are `<purpose>-challenge`. */
class PlainChallenges implements PasskeyChallengeService {
  public issue(purpose: PasskeyChallengePurpose): string {
    return `${purpose}-challenge`;
  }

  public verify(challenge: string, purpose: PasskeyChallengePurpose): void {
    if (challenge !== `${purpose}-challenge`) {
      throw new ValidationError('bad challenge');
    }
  }
}

/** Credentials are `{ id, challenge, ok }`; `ok: false` fails verification. */
class FakeCeremony implements PasskeyCeremony {
  public registrationOptions(challenge: string): Promise<PasskeyOptions> {
    return Promise.resolve({ kind: 'create', challenge });
  }

  public signInOptions(challenge: string): Promise<PasskeyOptions> {
    return Promise.resolve({ kind: 'get', challenge });
  }

  public challengeOf(credential: PasskeyCredential): string {
    return String(credential.challenge);
  }

  public passkeyIdOf(credential: PasskeyCredential): PasskeyId {
    return PasskeyIdSchema.parse(credential.id);
  }

  public verifyRegistration(credential: PasskeyCredential): Promise<NewPasskey> {
    return credential.ok === false
      ? Promise.reject(new ValidationError('no'))
      : Promise.resolve({
          id: this.passkeyIdOf(credential),
          publicKey: 'cGs',
          counter: 0,
          transports: ['internal'],
        });
  }

  public verifySignIn(
    credential: PasskeyCredential,
    _c: string,
    passkey: Passkey,
  ): Promise<number> {
    return credential.ok === false
      ? Promise.reject(new ValidationError('no'))
      : Promise.resolve(passkey.counter + 1);
  }
}

class PlainSessions implements AccessSessionService {
  public issue(passkeyId: PasskeyId): IssuedAccessSession {
    return { token: `session:${passkeyId}`, passkeyId, issuedAt: T0, expiresAt: T0 };
  }

  public verify(token: string): AccessSession {
    if (!token.startsWith('session:')) {
      throw new UnauthenticatedError('no');
    }
    return { passkeyId: PasskeyIdSchema.parse(token.slice('session:'.length)), issuedAt: T0 };
  }
}

class OneInvite implements PasskeyInviteValidator {
  public validate(inviteCode: string): void {
    if (inviteCode !== 'invite') {
      throw new ValidationError('Wrong invite code.');
    }
  }
}

async function stored(repository: InMemoryPasskeyRepository, counter = 0): Promise<void> {
  await repository.create({
    id: KEY,
    publicKey: 'cGs',
    counter,
    transports: ['internal'],
    createdAt: T0,
  });
}

describe('StartPasskeyRegistrationUseCase', () => {
  const useCase = (limit = 10) =>
    new StartPasskeyRegistrationUseCase(
      new OneInvite(),
      new PlainChallenges(),
      new FakeCeremony(),
      new InMemoryRateLimiter({ start_passkey_registration: { limit, windowSeconds: 60 } }, clock),
    );

  it('gives creation options with a registration challenge for the invited', async () => {
    await expect(useCase().execute({ inviteCode: 'invite', clientKey: 'ip' })).resolves.toEqual({
      options: { kind: 'create', challenge: 'register-challenge' },
    });
  });

  it('refuses a wrong invite code', async () => {
    await expect(
      useCase().execute({ inviteCode: 'guess', clientKey: 'ip' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('limits guesses per client', async () => {
    const limited = useCase(1);
    await limited.execute({ inviteCode: 'guess', clientKey: 'ip' }).catch(() => undefined);

    await expect(limited.execute({ inviteCode: 'invite', clientKey: 'ip' })).rejects.toBeInstanceOf(
      RateLimitedError,
    );
  });
});

describe('CompletePasskeyRegistrationUseCase', () => {
  it('stores the passkey and signs in', async () => {
    const passkeys = new InMemoryPasskeyRepository();
    const useCase = new CompletePasskeyRegistrationUseCase(
      new PlainChallenges(),
      new FakeCeremony(),
      passkeys,
      new PlainSessions(),
      clock,
    );

    await expect(
      useCase.execute({ credential: { id: KEY, challenge: 'register-challenge' } }),
    ).resolves.toMatchObject({ token: `session:${KEY}` });
    await expect(passkeys.findById(KEY)).resolves.toMatchObject({ createdAt: T0 });
  });

  it('refuses a credential made for a sign-in challenge', async () => {
    const passkeys = new InMemoryPasskeyRepository();
    const useCase = new CompletePasskeyRegistrationUseCase(
      new PlainChallenges(),
      new FakeCeremony(),
      passkeys,
      new PlainSessions(),
      clock,
    );

    await expect(
      useCase.execute({ credential: { id: KEY, challenge: 'sign_in-challenge' } }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(passkeys.findById(KEY)).resolves.toBeNull();
  });
});

describe('StartPasskeySignInUseCase', () => {
  it('gives request options with a sign-in challenge', async () => {
    await expect(
      new StartPasskeySignInUseCase(new PlainChallenges(), new FakeCeremony()).execute(),
    ).resolves.toEqual({ options: { kind: 'get', challenge: 'sign_in-challenge' } });
  });
});

describe('CompletePasskeySignInUseCase', () => {
  const setup = async (store = true) => {
    const passkeys = new InMemoryPasskeyRepository();
    if (store) {
      await stored(passkeys, 4);
    }
    const useCase = new CompletePasskeySignInUseCase(
      new PlainChallenges(),
      new FakeCeremony(),
      passkeys,
      passkeys,
      new PlainSessions(),
    );
    return { passkeys, useCase };
  };

  it('checks the signature, saves the counter and signs in', async () => {
    const { passkeys, useCase } = await setup();

    await expect(
      useCase.execute({ credential: { id: KEY, challenge: 'sign_in-challenge' } }),
    ).resolves.toMatchObject({ token: `session:${KEY}` });
    await expect(passkeys.findById(KEY)).resolves.toMatchObject({ counter: 5 });
  });

  it('refuses an unknown passkey', async () => {
    const { useCase } = await setup(false);

    await expect(
      useCase.execute({ credential: { id: KEY, challenge: 'sign_in-challenge' } }),
    ).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it('refuses a bad signature or challenge', async () => {
    const { useCase } = await setup();

    await expect(
      useCase.execute({ credential: { id: KEY, challenge: 'sign_in-challenge', ok: false } }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      useCase.execute({ credential: { id: KEY, challenge: 'register-challenge' } }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('RenewAccessSessionUseCase', () => {
  it('issues a fresh session while the passkey is stored', async () => {
    const passkeys = new InMemoryPasskeyRepository();
    await stored(passkeys);

    await expect(
      new RenewAccessSessionUseCase(new PlainSessions(), passkeys).execute({
        token: `session:${KEY}`,
      }),
    ).resolves.toMatchObject({ passkeyId: KEY });
  });

  it('refuses a session whose passkey was removed, or a bad token', async () => {
    const useCase = new RenewAccessSessionUseCase(
      new PlainSessions(),
      new InMemoryPasskeyRepository(),
    );

    await expect(useCase.execute({ token: `session:${KEY}` })).rejects.toThrow('removed');
    await expect(useCase.execute({ token: 'nope' })).rejects.toBeInstanceOf(UnauthenticatedError);
  });
});
