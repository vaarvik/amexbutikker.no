import { z } from 'zod';
import type { Brand } from '../shared/shared.model.js';

/** A passkey's credential id, base64url, as the phone's authenticator chose it. */
export type PasskeyId = Brand<string, 'PasskeyId'>;

export const PasskeyIdSchema: z.ZodType<PasskeyId> = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,1400}$/, 'base64url')
  .transform((value) => value as PasskeyId);

/** A passkey that may open the app: one per phone (or per synced keychain). */
export interface Passkey {
  readonly id: PasskeyId;
  /** The COSE public key, base64url. */
  readonly publicKey: string;
  /** The signature counter; Apple's synced passkeys always send 0. */
  readonly counter: number;
  /** How the browser reaches the authenticator (`internal`, `hybrid`…), passed back on sign-in. */
  readonly transports: readonly string[];
  readonly createdAt: Date;
}

export const PasskeySchema: z.ZodType<Passkey> = z.object({
  id: PasskeyIdSchema,
  publicKey: z.string().regex(/^[A-Za-z0-9_-]+$/, 'base64url'),
  counter: z.int().nonnegative(),
  transports: z.array(z.string().min(1)).readonly(),
  createdAt: z.date(),
});

/** A passkey as the registration ceremony returns it, before it is stored. */
export type NewPasskey = Omit<Passkey, 'createdAt'>;

/**
 * WebAuthn options for the browser (`PublicKeyCredentialCreationOptionsJSON` or
 * `PublicKeyCredentialRequestOptionsJSON`). Only the browser and the ceremony read them.
 */
export type PasskeyOptions = Readonly<Record<string, unknown>>;

/** What the browser's WebAuthn call returned, as JSON. Only the ceremony reads it. */
export type PasskeyCredential = Readonly<Record<string, unknown>>;

/** What each ceremony's challenge is for, so one cannot be used for the other. */
export type PasskeyChallengePurpose = 'register' | 'sign_in';

/** A browser that signed in with a passkey. */
export interface AccessSession {
  readonly passkeyId: PasskeyId;
  readonly issuedAt: Date;
}

/** A new session and the opaque token the browser keeps for it. */
export interface IssuedAccessSession extends AccessSession {
  readonly token: string;
  readonly expiresAt: Date;
}
