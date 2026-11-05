import { describe, expect, it } from 'vitest';
import { FetchDevicesApiClient } from '../../src/devices/fetch-devices-api.client';
import { RecordingTransport } from '../shared/recording.transport';

describe('FetchDevicesApiClient', () => {
  it('registers the device with its platform', async () => {
    const transport = new RecordingTransport().answer({
      userId: '0190a000-0000-7000-8000-0000000000aa',
      token: 'abc',
    });

    await expect(new FetchDevicesApiClient(transport).register('android')).resolves.toMatchObject({
      token: 'abc',
    });
    expect(transport.requests).toEqual([
      { method: 'POST', path: '/v1/devices', body: { platform: 'android' } },
    ]);
  });
});
