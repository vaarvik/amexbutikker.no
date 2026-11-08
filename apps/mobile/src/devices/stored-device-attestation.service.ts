import type { AttestDeviceRequestDto } from '@amexbutikker/contracts';
import type { KeyValueStorage } from '../shared/shared.ports';
import type {
  AppAttestModule,
  DeviceAttestationService,
  DeviceSession,
  DevicesApiClient,
} from './devices.ports';

export interface StoredDeviceAttestationServiceConfig {
  /** Storage key of the device token that was attested. */
  readonly key: string;
}

/**
 * Attests the device and remembers which device token it did that for, so it happens once per
 * token. A new token (the API rejected the old one) is attested again.
 */
export class StoredDeviceAttestationService implements DeviceAttestationService {
  private appAttesting: Promise<boolean> | null = null;

  public constructor(
    private readonly session: DeviceSession,
    private readonly api: DevicesApiClient,
    private readonly appAttest: AppAttestModule | null,
    private readonly storage: KeyValueStorage,
    private readonly config: StoredDeviceAttestationServiceConfig,
  ) {}

  public async isAttested(): Promise<boolean> {
    try {
      const token = await this.session.findToken();
      return token !== null && (await this.storage.getItem(this.config.key)) === token;
    } catch {
      return false;
    }
  }

  public attestWithAppAttest(): Promise<boolean> {
    // One attempt at a time: each makes a new key in the Secure Enclave.
    this.appAttesting ??= this.runAppAttest().finally(() => {
      this.appAttesting = null;
    });
    return this.appAttesting;
  }

  public attestWithTurnstile(token: string): Promise<boolean> {
    return this.attest(() => Promise.resolve({ kind: 'turnstile', token }));
  }

  private async runAppAttest(): Promise<boolean> {
    const module = this.appAttest;
    if (module === null || !module.isSupported() || (await this.isAttested())) {
      return false;
    }
    return this.attest(async (deviceToken) => {
      const challenge = await this.api.challenge(deviceToken);
      const keyId = await module.generateKey();
      const attestationObject = await module.attestKey(keyId, challenge);
      return { kind: 'app_attest', keyId, attestationObject, challenge };
    });
  }

  private async attest(
    proof: (deviceToken: string) => Promise<AttestDeviceRequestDto>,
  ): Promise<boolean> {
    try {
      const deviceToken = await this.session.getToken();
      await this.api.attest(deviceToken, await proof(deviceToken));
      await this.storage.setItem(this.config.key, deviceToken);
      return true;
    } catch {
      return false;
    }
  }
}
