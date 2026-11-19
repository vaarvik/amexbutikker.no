import { PasskeyOptionsResponseDtoSchema } from '@amexbutikker/contracts';
import type { PasskeyCredential, PasskeyOptions } from '@amexbutikker/contracts';
import { z } from 'zod';
import type { JsonTransport } from '../shared/shared.ports';
import type { AccessApiClient } from './access.ports';

/** 204 No Content. */
const NoContentSchema = z.undefined();

export class FetchAccessApiClient implements AccessApiClient {
  public constructor(private readonly transport: JsonTransport) {}

  public renew(): Promise<void> {
    return this.transport.request({ method: 'POST', path: '/v1/access/session' }, NoContentSchema);
  }

  public async registrationOptions(inviteCode: string): Promise<PasskeyOptions> {
    const { options } = await this.transport.request(
      { method: 'POST', path: '/v1/access/registration/options', body: { inviteCode } },
      PasskeyOptionsResponseDtoSchema,
    );
    return options;
  }

  public register(credential: PasskeyCredential): Promise<void> {
    return this.transport.request(
      { method: 'POST', path: '/v1/access/registration', body: { credential } },
      NoContentSchema,
    );
  }

  public async signInOptions(): Promise<PasskeyOptions> {
    const { options } = await this.transport.request(
      { method: 'POST', path: '/v1/access/sign-in/options' },
      PasskeyOptionsResponseDtoSchema,
    );
    return options;
  }

  public signIn(credential: PasskeyCredential): Promise<void> {
    return this.transport.request(
      { method: 'POST', path: '/v1/access/sign-in', body: { credential } },
      NoContentSchema,
    );
  }
}
