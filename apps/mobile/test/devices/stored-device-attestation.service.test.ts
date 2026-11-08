import type {
  AttestDeviceRequestDto,
  AttestDeviceResponseDto,
  RegisterDeviceResponseDto,
} from '@amexbutikker/contracts';
import { describe, expect, it } from 'vitest';
import type {
  AppAttestModule,
  DeviceSession,
  DevicesApiClient,
} from '../../src/devices/devices.ports';
import { StoredDeviceAttestationService } from '../../src/devices/stored-device-attestation.service';
import type { KeyValueStorage } from '../../src/shared/shared.ports';
import { MapKeyValueStorage } from '../shared/mobile-test.data';

class StubSession implements DeviceSession {
  public constructor(public token: string | null = 'tok-1') {}

  public findToken(): Promise<string | null> {
    return Promise.resolve(this.token);
  }

  public getToken(): Promise<string> {
    this.token ??= 'registered';
    return Promise.resolve(this.token);
  }

  public reset(): Promise<void> {
    this.token = null;
    return Promise.resolve();
  }
}

class StubApi implements DevicesApiClient {
  public readonly proofs: [string, AttestDeviceRequestDto][] = [];
  public refuse = false;

  public register(): Promise<RegisterDeviceResponseDto> {
    return Promise.reject(new Error('not used'));
  }

  public challenge(token: string): Promise<string> {
    return Promise.resolve(`challenge-for-${token}`);
  }

  public attest(token: string, proof: AttestDeviceRequestDto): Promise<AttestDeviceResponseDto> {
    this.proofs.push([token, proof]);
    return this.refuse ? Promise.reject(new Error('400')) : Promise.resolve({ kind: proof.kind });
  }
}

class StubAppAttest implements AppAttestModule {
  public keys = 0;

  public constructor(private readonly supported = true) {}

  public isSupported(): boolean {
    return this.supported;
  }

  public generateKey(): Promise<string> {
    this.keys += 1;
    return Promise.resolve(`key-${String(this.keys)}`);
  }

  public attestKey(keyId: string, challenge: string): Promise<string> {
    return Promise.resolve(`attestation(${keyId},${challenge})`);
  }
}

class BrokenStorage implements KeyValueStorage {
  public getItem(): Promise<string | null> {
    return Promise.reject(new Error('disk'));
  }

  public setItem(): Promise<void> {
    return Promise.reject(new Error('disk'));
  }

  public removeItem(): Promise<void> {
    return Promise.reject(new Error('disk'));
  }
}

function setup(
  options: {
    appAttest?: AppAttestModule | null;
    session?: StubSession;
    storage?: KeyValueStorage;
  } = {},
) {
  const session = options.session ?? new StubSession();
  const api = new StubApi();
  const service = new StoredDeviceAttestationService(
    session,
    api,
    options.appAttest === undefined ? new StubAppAttest() : options.appAttest,
    options.storage ?? new MapKeyValueStorage(),
    { key: 'attested' },
  );
  return { session, api, service };
}

describe('StoredDeviceAttestationService', () => {
  it('attests an iPhone once with a new key against the API challenge', async () => {
    const appAttest = new StubAppAttest();
    const { api, service } = setup({ appAttest });

    await expect(service.attestWithAppAttest()).resolves.toBe(true);
    await expect(service.attestWithAppAttest()).resolves.toBe(false);

    expect(api.proofs).toEqual([
      [
        'tok-1',
        {
          kind: 'app_attest',
          keyId: 'key-1',
          attestationObject: 'attestation(key-1,challenge-for-tok-1)',
          challenge: 'challenge-for-tok-1',
        },
      ],
    ]);
    await expect(service.isAttested()).resolves.toBe(true);
  });

  it('runs one App Attest attempt at a time', async () => {
    const appAttest = new StubAppAttest();
    const { service } = setup({ appAttest });

    await Promise.all([service.attestWithAppAttest(), service.attestWithAppAttest()]);

    expect(appAttest.keys).toBe(1);
  });

  it('attests again for a new device token', async () => {
    const session = new StubSession();
    const { api, service } = setup({ session });
    await service.attestWithAppAttest();

    session.token = 'tok-2';

    await expect(service.isAttested()).resolves.toBe(false);
    await expect(service.attestWithAppAttest()).resolves.toBe(true);
    expect(api.proofs.map(([token]) => token)).toEqual(['tok-1', 'tok-2']);
  });

  it.each([
    ['without the native module', null],
    ['where App Attest is not supported (the simulator)', new StubAppAttest(false)],
  ])('does nothing %s', async (_name, appAttest) => {
    const { api, service } = setup({ appAttest });

    await expect(service.attestWithAppAttest()).resolves.toBe(false);
    expect(api.proofs).toEqual([]);
  });

  it('attests a browser with a Turnstile token, registering first when needed', async () => {
    const { api, service } = setup({ session: new StubSession(null) });

    await expect(service.attestWithTurnstile('ts-token')).resolves.toBe(true);

    expect(api.proofs).toEqual([['registered', { kind: 'turnstile', token: 'ts-token' }]]);
    await expect(service.isAttested()).resolves.toBe(true);
  });

  it('remembers nothing when the API refuses', async () => {
    const { api, service } = setup();
    api.refuse = true;

    await expect(service.attestWithTurnstile('t')).resolves.toBe(false);
    await expect(service.isAttested()).resolves.toBe(false);
  });

  it('is not attested without a token, or when the storage fails', async () => {
    await expect(setup({ session: new StubSession(null) }).service.isAttested()).resolves.toBe(
      false,
    );
    const broken = setup({ storage: new BrokenStorage() });
    await expect(broken.service.isAttested()).resolves.toBe(false);
    await expect(broken.service.attestWithTurnstile('t')).resolves.toBe(false);
  });
});
