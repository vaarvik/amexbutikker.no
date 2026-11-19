import type { PasskeyCredential, PasskeyOptions } from '@amexbutikker/contracts';
import { describe, expect, it } from 'vitest';
import type { AccessApiClient, PasskeyPrompt } from '../../src/access/access.ports';
import { PasskeyAccessService } from '../../src/access/passkey-access.service';
import { ApiError } from '../../src/shared/fetch-json.transport';

class FakeAccessApi implements AccessApiClient {
  public readonly calls: string[] = [];

  public constructor(private readonly renewError: Error | null = null) {}

  public renew(): Promise<void> {
    this.calls.push('renew');
    return this.renewError === null ? Promise.resolve() : Promise.reject(this.renewError);
  }

  public registrationOptions(inviteCode: string): Promise<PasskeyOptions> {
    this.calls.push(`registrationOptions:${inviteCode}`);
    return Promise.resolve({ challenge: 'register' });
  }

  public register(credential: PasskeyCredential): Promise<void> {
    this.calls.push(`register:${String(credential.id)}`);
    return Promise.resolve();
  }

  public signInOptions(): Promise<PasskeyOptions> {
    this.calls.push('signInOptions');
    return Promise.resolve({ challenge: 'sign-in' });
  }

  public signIn(credential: PasskeyCredential): Promise<void> {
    this.calls.push(`signIn:${String(credential.id)}`);
    return Promise.resolve();
  }
}

/** Answers each dialog with a credential named after the options' challenge. */
class EchoPrompt implements PasskeyPrompt {
  public create(options: PasskeyOptions): Promise<PasskeyCredential> {
    return Promise.resolve({ id: `created-for-${String(options.challenge)}` });
  }

  public get(options: PasskeyOptions): Promise<PasskeyCredential> {
    return Promise.resolve({ id: `got-for-${String(options.challenge)}` });
  }
}

describe('PasskeyAccessService', () => {
  it('is signed in when the session renews', async () => {
    await expect(new PasskeyAccessService(new FakeAccessApi(), null).check()).resolves.toBe(
      'signed_in',
    );
  });

  it('is signed out when the API answers 401', async () => {
    const api = new FakeAccessApi(new ApiError('unauthorized', 401, 'Sign in.'));

    await expect(new PasskeyAccessService(api, null).check()).resolves.toBe('signed_out');
  });

  it('is open when the API has no sign-in, or cannot be reached', async () => {
    const missing = new FakeAccessApi(new ApiError('not_found', 404, 'No route.'));
    const offline = new FakeAccessApi(new ApiError('unreachable', null, 'Offline.'));

    await expect(new PasskeyAccessService(missing, null).check()).resolves.toBe('open');
    await expect(new PasskeyAccessService(offline, null).check()).resolves.toBe('open');
  });

  it('signs in with the passkey the browser picks', async () => {
    const api = new FakeAccessApi();

    await new PasskeyAccessService(api, new EchoPrompt()).signIn();
    expect(api.calls).toEqual(['signInOptions', 'signIn:got-for-sign-in']);
  });

  it('adds a passkey with the trimmed invite code', async () => {
    const api = new FakeAccessApi();

    await new PasskeyAccessService(api, new EchoPrompt()).register('  invite-1 ');
    expect(api.calls).toEqual(['registrationOptions:invite-1', 'register:created-for-register']);
  });

  it('refuses passkeys where the platform has none', async () => {
    const service = new PasskeyAccessService(new FakeAccessApi(), null);

    await expect(service.signIn()).rejects.toThrow('only in the browser');
    await expect(service.register('invite-1')).rejects.toThrow('only in the browser');
  });
});
