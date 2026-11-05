import type { DevicePlatform } from '@amexbutikker/contracts';
import type { KeyValueStorage } from '../shared/shared.ports';
import type { DeviceSession, DevicesApiClient } from './devices.ports';

export interface StoredDeviceSessionConfig {
  readonly platform: DevicePlatform;
  /** Storage key of the token. */
  readonly key: string;
}

/** Registers the device once and keeps its token in storage (SecureStore on phones). */
export class StoredDeviceSession implements DeviceSession {
  private registering: Promise<string> | null = null;

  public constructor(
    private readonly api: DevicesApiClient,
    private readonly storage: KeyValueStorage,
    private readonly config: StoredDeviceSessionConfig,
  ) {}

  public findToken(): Promise<string | null> {
    return this.storage.getItem(this.config.key);
  }

  public async getToken(): Promise<string> {
    const stored = await this.findToken();
    if (stored !== null) {
      return stored;
    }
    this.registering ??= this.register().finally(() => {
      this.registering = null;
    });
    return this.registering;
  }

  public reset(): Promise<void> {
    return this.storage.removeItem(this.config.key);
  }

  private async register(): Promise<string> {
    const { token } = await this.api.register(this.config.platform);
    await this.storage.setItem(this.config.key, token);
    return token;
  }
}
