import { ValidationError } from '@amexbutikker/contracts';
import type { TurnstileValidator } from '@amexbutikker/contracts';
import { z } from 'zod';

export interface HttpTurnstileValidatorConfig {
  readonly secretKey: string;
  /** Hostnames the widget may run on; empty accepts any (Cloudflare's test keys report none). */
  readonly hostnames: readonly string[];
  readonly siteverifyUrl: string;
}

const SiteverifySchema = z.object({
  success: z.boolean(),
  hostname: z.string().optional(),
  'error-codes': z.array(z.string()).optional(),
});

/** Checks a token with Cloudflare's siteverify endpoint. Only the token and the secret are sent. */
export class HttpTurnstileValidator implements TurnstileValidator {
  public constructor(
    private readonly config: HttpTurnstileValidatorConfig,
    private readonly fetchFn: typeof globalThis.fetch,
  ) {}

  public async validate(token: string): Promise<void> {
    const response = await this.fetchFn(this.config.siteverifyUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: this.config.secretKey, response: token }).toString(),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      throw new Error(`Turnstile siteverify answered ${String(response.status)}.`);
    }
    const result = SiteverifySchema.parse(await response.json());
    if (!result.success) {
      throw this.rejected((result['error-codes'] ?? []).join(', ') || 'not accepted');
    }
    const { hostnames } = this.config;
    if (
      hostnames.length > 0 &&
      (result.hostname === undefined || !hostnames.includes(result.hostname))
    ) {
      throw this.rejected(`solved on ${result.hostname ?? 'an unknown host'}`);
    }
  }

  private rejected(reason: string): ValidationError {
    return new ValidationError('The Turnstile check was rejected.', [
      { path: ['token'], message: reason },
    ]);
  }
}
