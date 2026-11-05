import { RegisterDeviceResponseDtoSchema } from '@amexbutikker/contracts';
import type { DevicePlatform, RegisterDeviceResponseDto } from '@amexbutikker/contracts';
import type { JsonTransport } from '../shared/shared.ports';
import type { DevicesApiClient } from './devices.ports';

export class FetchDevicesApiClient implements DevicesApiClient {
  public constructor(private readonly transport: JsonTransport) {}

  public register(platform: DevicePlatform): Promise<RegisterDeviceResponseDto> {
    return this.transport.request(
      { method: 'POST', path: '/v1/devices', body: { platform } },
      RegisterDeviceResponseDtoSchema,
    );
  }
}
