import { PasskeyIdSchema, ValidationError } from '@amexbutikker/contracts';
import type {
  NewPasskey,
  Passkey,
  PasskeyCeremony,
  PasskeyCredential,
  PasskeyId,
  PasskeyOptions,
} from '@amexbutikker/contracts';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import { z } from 'zod';

export interface WebAuthnPasskeyServiceConfig {
  /** The site's origin, `https://amex.johann.no`. Its host is the relying party id. */
  readonly origin: string;
  /** Shown by the phone when it saves the passkey. */
  readonly rpName: string;
}

const base64url = z.string().regex(/^[A-Za-z0-9_-]+$/);

const CredentialSchema = z.object({
  id: base64url,
  rawId: base64url,
  type: z.literal('public-key'),
  clientExtensionResults: z.record(z.string(), z.unknown()).default({}),
  authenticatorAttachment: z.enum(['platform', 'cross-platform']).optional(),
  response: z.object({ clientDataJSON: base64url }).loose(),
});

const ClientDataSchema = z.object({ challenge: base64url });

/** WebAuthn through @simplewebauthn/server: discoverable passkeys, user verification required. */
export class WebAuthnPasskeyService implements PasskeyCeremony {
  private readonly rpId: string;

  public constructor(private readonly config: WebAuthnPasskeyServiceConfig) {
    this.rpId = new URL(config.origin).hostname;
  }

  public async registrationOptions(challenge: string): Promise<PasskeyOptions> {
    // Spread into a plain object: the library's interfaces have no index signature.
    return {
      ...(await generateRegistrationOptions({
        rpName: this.config.rpName,
        rpID: this.rpId,
        userName: this.config.rpName,
        challenge: Buffer.from(challenge, 'base64url'),
        attestationType: 'none',
        authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
      })),
    };
  }

  public async signInOptions(challenge: string): Promise<PasskeyOptions> {
    return {
      ...(await generateAuthenticationOptions({
        rpID: this.rpId,
        challenge: Buffer.from(challenge, 'base64url'),
        userVerification: 'required',
      })),
    };
  }

  public challengeOf(credential: PasskeyCredential): string {
    const { response } = this.parse(credential);
    let clientData: unknown;
    try {
      clientData = JSON.parse(Buffer.from(response.clientDataJSON, 'base64url').toString('utf8'));
    } catch {
      throw new ValidationError('Malformed passkey client data.');
    }
    const parsed = ClientDataSchema.safeParse(clientData);
    if (!parsed.success) {
      throw new ValidationError('Malformed passkey client data.');
    }
    return parsed.data.challenge;
  }

  public passkeyIdOf(credential: PasskeyCredential): PasskeyId {
    return PasskeyIdSchema.parse(this.parse(credential).id);
  }

  public async verifyRegistration(
    credential: PasskeyCredential,
    challenge: string,
  ): Promise<NewPasskey> {
    const result = await this.check(() =>
      verifyRegistrationResponse({
        response: this.parse(credential) as unknown as RegistrationResponseJSON,
        expectedChallenge: challenge,
        expectedOrigin: this.config.origin,
        expectedRPID: this.rpId,
        requireUserVerification: true,
      }),
    );
    if (!result.verified) {
      throw new ValidationError('The passkey could not be verified.');
    }
    const { credential: created } = result.registrationInfo;
    return {
      id: PasskeyIdSchema.parse(created.id),
      publicKey: Buffer.from(created.publicKey).toString('base64url'),
      counter: created.counter,
      transports: created.transports ?? [],
    };
  }

  public async verifySignIn(
    credential: PasskeyCredential,
    challenge: string,
    passkey: Passkey,
  ): Promise<number> {
    const result = await this.check(() =>
      verifyAuthenticationResponse({
        response: this.parse(credential) as unknown as AuthenticationResponseJSON,
        expectedChallenge: challenge,
        expectedOrigin: this.config.origin,
        expectedRPID: this.rpId,
        requireUserVerification: true,
        credential: {
          id: passkey.id,
          publicKey: new Uint8Array(Buffer.from(passkey.publicKey, 'base64url')),
          counter: passkey.counter,
          transports: [...passkey.transports],
        },
      }),
    );
    if (!result.verified) {
      throw new ValidationError('The passkey signature could not be verified.');
    }
    return result.authenticationInfo.newCounter;
  }

  private parse(credential: PasskeyCredential): z.infer<typeof CredentialSchema> {
    const parsed = CredentialSchema.safeParse(credential);
    if (!parsed.success) {
      throw new ValidationError('Malformed passkey credential.');
    }
    return parsed.data;
  }

  /** The library throws plain Errors for every failed check; they are the caller's mistake. */
  private async check<T>(verify: () => Promise<T>): Promise<T> {
    try {
      return await verify();
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(
        error instanceof Error ? error.message : 'The passkey could not be verified.',
      );
    }
  }
}
