import type {
  AccessSession,
  IssuedAccessSession,
  NewPasskey,
  Passkey,
  PasskeyChallengePurpose,
  PasskeyCredential,
  PasskeyId,
  PasskeyOptions,
} from './access.model.js';

/** Reads the passkeys that may open the app. */
export interface PasskeyReader {
  /** null when no passkey has this id. */
  findById(id: PasskeyId): Promise<Passkey | null>;
}

/** Records passkeys. */
export interface PasskeyWriter {
  /** @throws ConflictError when a passkey with this id exists. */
  create(passkey: Passkey): Promise<void>;
  /** @throws NotFoundError when no passkey has this id. */
  saveCounter(id: PasskeyId, counter: number): Promise<void>;
}

/**
 * Challenges that prove themselves: signed, for one purpose, valid for a few minutes. Nothing is
 * stored; the browser echoes the challenge inside the credential it returns.
 */
export interface PasskeyChallengeService {
  /** @returns a base64url challenge. */
  issue(purpose: PasskeyChallengePurpose): string;
  /** @throws ValidationError when the challenge is forged, for the other purpose or expired. */
  verify(challenge: string, purpose: PasskeyChallengePurpose): void;
}

/** The WebAuthn ceremonies: options for the browser, and checks of what it sends back. */
export interface PasskeyCeremony {
  registrationOptions(challenge: string): Promise<PasskeyOptions>;
  signInOptions(challenge: string): Promise<PasskeyOptions>;
  /**
   * The challenge the browser signed, read from the credential's client data. Not yet checked.
   *
   * @throws ValidationError when the credential is malformed.
   */
  challengeOf(credential: PasskeyCredential): string;
  /** @throws ValidationError when the credential is malformed. */
  passkeyIdOf(credential: PasskeyCredential): PasskeyId;
  /**
   * Checks origin, relying party, challenge and user verification.
   *
   * @throws ValidationError when any check fails.
   */
  verifyRegistration(credential: PasskeyCredential, challenge: string): Promise<NewPasskey>;
  /**
   * Checks the signature against the stored key, and origin, relying party and challenge.
   *
   * @returns the new signature counter.
   * @throws ValidationError when any check fails.
   */
  verifySignIn(credential: PasskeyCredential, challenge: string, passkey: Passkey): Promise<number>;
}

/** Whether someone may add a passkey. */
export interface PasskeyInviteValidator {
  /** @throws ValidationError when the code is wrong, or no one may add passkeys any more. */
  validate(inviteCode: string): void;
}

/** Issues and checks the signed session a signed-in browser keeps. */
export interface AccessSessionService {
  issue(passkeyId: PasskeyId): IssuedAccessSession;
  /** @throws UnauthenticatedError when the token is malformed, forged or expired. */
  verify(token: string): AccessSession;
}
