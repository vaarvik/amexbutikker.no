import { ValidationError } from '@amexbutikker/contracts';
import type { AppAttestValidator } from '@amexbutikker/contracts';

/** Used when APP_ATTEST_APP_IDS is not set: every attestation is refused. */
export class UnconfiguredAppAttestValidator implements AppAttestValidator {
  public validate(): Promise<void> {
    return Promise.reject(new ValidationError('App Attest is not configured on this server.'));
  }
}
