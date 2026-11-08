import type { DevicePlatform, RegisterDeviceResponseDto, UserId } from '@amexbutikker/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import type { DevicesApiClient } from '../../src/devices/devices.ports';
import { StoredDeviceSession } from '../../src/devices/stored-device.session';
import { MapKeyValueStorage } from '../shared/mobile-test.data';

class CountingDevicesApi implements DevicesApiClient {
  public platforms: DevicePlatform[] = [];

  public register(platform: DevicePlatform): Promise<RegisterDeviceResponseDto> {
    this.platforms.push(platform);
    return Promise.resolve({
      userId: '0190a000-0000-7000-8000-0000000000aa' as UserId,
      token: `token-${String(this.platforms.length)}`,
    });
  }

  public challenge(): Promise<string> {
    return Promise.reject(new Error('not used'));
  }

  public attest(): Promise<never> {
    return Promise.reject(new Error('not used'));
  }
}

describe('StoredDeviceSession', () => {
  let api: CountingDevicesApi;
  let storage: MapKeyValueStorage;
  let session: StoredDeviceSession;

  beforeEach(() => {
    api = new CountingDevicesApi();
    storage = new MapKeyValueStorage();
    session = new StoredDeviceSession(api, storage, { platform: 'ios', key: 'device-token' });
  });

  it('has no token before registering, and findToken never registers', async () => {
    await expect(session.findToken()).resolves.toBeNull();
    expect(api.platforms).toEqual([]);
  });

  it('registers once, even for concurrent calls, and stores the token', async () => {
    const tokens = await Promise.all([session.getToken(), session.getToken()]);

    expect(tokens).toEqual(['token-1', 'token-1']);
    expect(api.platforms).toEqual(['ios']);
    expect(storage.values.get('device-token')).toBe('token-1');
    await expect(session.getToken()).resolves.toBe('token-1');
  });

  it('registers again after a reset', async () => {
    await session.getToken();

    await session.reset();

    await expect(session.findToken()).resolves.toBeNull();
    await expect(session.getToken()).resolves.toBe('token-2');
  });
});
