import { ValidationError } from '@amexbutikker/contracts';
import type { TurnstileValidator } from '@amexbutikker/contracts';

/** Used when TURNSTILE_SECRET_KEY is not set: every token is refused. */
export class UnconfiguredTurnstileValidator implements TurnstileValidator {
  public validate(): Promise<void> {
    return Promise.reject(new ValidationError('Turnstile is not configured on this server.'));
  }
}
