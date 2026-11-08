import {
  AttestDeviceResponseDtoSchema,
  AttestationChallengeResponseDtoSchema,
  RegisterDeviceResponseDtoSchema,
} from '@amexbutikker/contracts';
import type {
  AttestDeviceRequestDto,
  AttestDeviceResponseDto,
  DevicePlatform,
  RegisterDeviceResponseDto,
} from '@amexbutikker/contracts';
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

  public async challenge(token: string): Promise<string> {
    const { challenge } = await this.transport.request(
      { method: 'POST', path: '/v1/devices/me/challenge', token },
      AttestationChallengeResponseDtoSchema,
    );
    return challenge;
  }

  public attest(token: string, proof: AttestDeviceRequestDto): Promise<AttestDeviceResponseDto> {
    return this.transport.request(
      { method: 'POST', path: '/v1/devices/me/attestation', body: proof, token },
      AttestDeviceResponseDtoSchema,
    );
  }
}
