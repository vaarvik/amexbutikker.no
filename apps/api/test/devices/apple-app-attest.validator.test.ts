import type { Clock } from '@amexbutikker/contracts';
import { ValidationError } from '@amexbutikker/contracts';
import { encode } from 'cbor-x';
import { beforeAll, describe, expect, it } from 'vitest';
import { AppleAppAttestValidator } from '../../src/devices/apple-app-attest.validator.js';
import { APPLE_APP_ATTESTATION_ROOT_CA_PEM } from '../../src/devices/devices.model.js';
import type { AppAttestEnvironment } from '../../src/devices/devices.model.js';
import { APP_ID, NOT_AFTER, appAttestFixture, testRoot } from './app-attest-test.data.js';

class FixedClock implements Clock {
  public constructor(private readonly at = new Date('2026-06-01T00:00:00.000Z')) {}

  public now(): Date {
    return this.at;
  }
}

describe('AppleAppAttestValidator', () => {
  let root: Awaited<ReturnType<typeof testRoot>>;
  beforeAll(async () => {
    root = await testRoot();
  });

  function validator(
    rootPem: string,
    options: { environments?: AppAttestEnvironment[]; clock?: Clock } = {},
  ) {
    return new AppleAppAttestValidator(
      {
        appIds: [APP_ID],
        rootCertificatePem: rootPem,
        environments: options.environments ?? ['production'],
      },
      options.clock ?? new FixedClock(),
    );
  }

  async function rejection(promise: Promise<void>): Promise<string | undefined> {
    const error: unknown = await promise.then(
      () => null,
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(ValidationError);
    return (error as ValidationError).issues[0]?.message;
  }

  it('accepts an attestation built like Apple builds one', async () => {
    const { rootPem, input } = await appAttestFixture(root);

    await expect(validator(rootPem).validate(input)).resolves.toBeUndefined();
  });

  it('accepts a development build when development is allowed', async () => {
    const { rootPem, input } = await appAttestFixture(root, {
      aaguid: Buffer.from('appattestdevelop'),
    });

    await expect(
      validator(rootPem, { environments: ['production', 'development'] }).validate(input),
    ).resolves.toBeUndefined();
    expect(await rejection(validator(rootPem).validate(input))).toBe(
      'is from an environment that is not allowed',
    );
  });

  it('refuses a chain that does not end at the configured root', async () => {
    const { input } = await appAttestFixture(root);
    const other = await testRoot('Another Root');

    expect(await rejection(validator(other.cert.toString('pem')).validate(input))).toBe(
      'is not certified by Apple App Attest',
    );
    expect(await rejection(validator(APPLE_APP_ATTESTATION_ROOT_CA_PEM).validate(input))).toBe(
      'is not certified by Apple App Attest',
    );
  });

  it('refuses expired certificates', async () => {
    const { rootPem, input } = await appAttestFixture(root);
    const later = new FixedClock(new Date(NOT_AFTER.getTime() + 1000));

    expect(await rejection(validator(rootPem, { clock: later }).validate(input))).toBe(
      'is not certified by Apple App Attest',
    );
  });

  it('refuses an attestation for another challenge', async () => {
    const { rootPem, input } = await appAttestFixture(root, { signedChallenge: 'c1.other' });

    expect(await rejection(validator(rootPem).validate(input))).toBe(
      'does not answer this challenge',
    );
  });

  it('refuses another key id', async () => {
    const { rootPem, input } = await appAttestFixture(root);

    expect(
      await rejection(
        validator(rootPem).validate({ ...input, keyId: Buffer.alloc(32, 1).toString('base64') }),
      ),
    ).toBe('is for another key');
  });

  it('refuses another app', async () => {
    const { rootPem, input } = await appAttestFixture(root, { appId: 'ZZZZZ99999.com.other.app' });

    expect(await rejection(validator(rootPem).validate(input))).toBe('is for another app');
  });

  it('refuses a key that has signed before', async () => {
    const { rootPem, input } = await appAttestFixture(root, { counter: 1 });

    expect(await rejection(validator(rootPem).validate(input))).toBe('has been used before');
  });

  it('refuses another credential id', async () => {
    const { rootPem, input } = await appAttestFixture(root, { credentialId: Buffer.alloc(32, 7) });

    expect(await rejection(validator(rootPem).validate(input))).toBe('names another credential');
  });

  it.each([
    ['not CBOR', Buffer.from([0xff, 0x00]).toString('base64')],
    ['another format', Buffer.from(encode({ fmt: 'packed' })).toString('base64')],
  ])('refuses %s', async (_name, attestationObject) => {
    const { rootPem, input } = await appAttestFixture(root);

    expect(await rejection(validator(rootPem).validate({ ...input, attestationObject }))).toMatch(
      /could not be read|is not an App Attest attestation/,
    );
  });
});
