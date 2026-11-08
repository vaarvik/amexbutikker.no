import { ValidationError } from '@amexbutikker/contracts';
import { describe, expect, it } from 'vitest';
import { HttpTurnstileValidator } from '../../src/devices/http-turnstile.validator.js';
import { UnconfiguredAppAttestValidator } from '../../src/devices/unconfigured-app-attest.validator.js';
import { UnconfiguredTurnstileValidator } from '../../src/devices/unconfigured-turnstile.validator.js';

const URL_ = 'https://challenges.example/siteverify';

function validatorAnswering(body: unknown, status = 200, hostnames: string[] = []) {
  const requests: { url: string; body: string; method: string | undefined }[] = [];
  const fetchFn = (url: string | URL | Request, init?: RequestInit) => {
    requests.push({
      url: url instanceof Request ? url.url : url.toString(),
      body: typeof init?.body === 'string' ? init.body : '',
      method: init?.method,
    });
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
  };
  const validator = new HttpTurnstileValidator(
    { secretKey: 'secret', hostnames, siteverifyUrl: URL_ },
    fetchFn,
  );
  return { validator, requests };
}

describe('HttpTurnstileValidator', () => {
  it('accepts a token Cloudflare accepts, sending only the secret and the token', async () => {
    const { validator, requests } = validatorAnswering({
      success: true,
      hostname: 'amex.johann.no',
    });

    await expect(validator.validate('token-1')).resolves.toBeUndefined();
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe(URL_);
    expect(requests[0]?.method).toBe('POST');
    expect(requests[0]?.body).toBe('secret=secret&response=token-1');
  });

  it('refuses a token Cloudflare refuses, with its error codes', async () => {
    const { validator } = validatorAnswering({
      success: false,
      'error-codes': ['timeout-or-duplicate'],
    });

    const error: unknown = await validator.validate('old').catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).issues[0]?.message).toBe('timeout-or-duplicate');
  });

  it('refuses a token solved on another host when hostnames are set', async () => {
    const { validator } = validatorAnswering({ success: true, hostname: 'evil.example' }, 200, [
      'amex.johann.no',
    ]);

    await expect(validator.validate('t')).rejects.toBeInstanceOf(ValidationError);
  });

  it('refuses a token without a hostname when hostnames are set', async () => {
    const { validator } = validatorAnswering({ success: true }, 200, ['amex.johann.no']);

    await expect(validator.validate('t')).rejects.toBeInstanceOf(ValidationError);
  });

  it('fails, not refuses, when Cloudflare is down', async () => {
    const { validator } = validatorAnswering({}, 503);

    const error: unknown = await validator.validate('t').catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(ValidationError);
  });
});

describe('Unconfigured validators', () => {
  it('refuse everything', async () => {
    await expect(new UnconfiguredTurnstileValidator().validate()).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(new UnconfiguredAppAttestValidator().validate()).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});
