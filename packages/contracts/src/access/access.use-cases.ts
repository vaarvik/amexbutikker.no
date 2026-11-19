import type { IssuedAccessSession, PasskeyCredential, PasskeyOptions } from './access.model.js';

export interface StartPasskeyRegistrationInput {
  readonly inviteCode: string;
  /** Identifies the caller for rate limiting, e.g. a hash of the client IP. Never stored. */
  readonly clientKey: string;
}

export interface PasskeyOptionsOutput {
  readonly options: PasskeyOptions;
}

/** Options for creating a passkey, for someone with the invite code. */
export interface StartPasskeyRegistration {
  /**
   * @throws RateLimitedError when one client tries too often.
   * @throws ValidationError when the invite code is wrong.
   */
  execute(input: StartPasskeyRegistrationInput): Promise<PasskeyOptionsOutput>;
}

export interface CompletePasskeyCeremonyInput {
  readonly credential: PasskeyCredential;
}

/** Stores the new passkey and signs its browser in. */
export interface CompletePasskeyRegistration {
  /**
   * @throws ValidationError when the credential does not check out, or its challenge was not
   *   issued for a registration.
   * @throws ConflictError when the passkey is already stored.
   */
  execute(input: CompletePasskeyCeremonyInput): Promise<IssuedAccessSession>;
}

/** Options for signing in with any stored passkey (the phone offers the ones it has). */
export interface StartPasskeySignIn {
  execute(): Promise<PasskeyOptionsOutput>;
}

/** Checks a passkey signature and signs the browser in. */
export interface CompletePasskeySignIn {
  /**
   * @throws UnauthenticatedError when no stored passkey has the credential's id.
   * @throws ValidationError when the signature, origin or challenge does not check out.
   */
  execute(input: CompletePasskeyCeremonyInput): Promise<IssuedAccessSession>;
}

export interface RenewAccessSessionInput {
  readonly token: string;
}

/** A fresh session for a browser that is signed in, so use keeps it signed in. */
export interface RenewAccessSession {
  /** @throws UnauthenticatedError when the token is invalid or its passkey was removed. */
  execute(input: RenewAccessSessionInput): Promise<IssuedAccessSession>;
}
