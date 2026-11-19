import type { PasskeyCredential, PasskeyOptions } from '@amexbutikker/contracts';
import type { AccessState } from './access.model';

/** The `/v1/access` endpoints. The session travels as an HttpOnly cookie the app never sees. */
export interface AccessApiClient {
  /** `POST /v1/access/session`: renews the session. @throws ApiError (401 when signed out). */
  renew(): Promise<void>;
  registrationOptions(inviteCode: string): Promise<PasskeyOptions>;
  register(credential: PasskeyCredential): Promise<void>;
  signInOptions(): Promise<PasskeyOptions>;
  signIn(credential: PasskeyCredential): Promise<void>;
}

/** The browser's passkey dialogs (Face ID on an iPhone). */
export interface PasskeyPrompt {
  /** @throws Error when the person cancels or the browser refuses. */
  create(options: PasskeyOptions): Promise<PasskeyCredential>;
  /** @throws Error when the person cancels or the browser refuses. */
  get(options: PasskeyOptions): Promise<PasskeyCredential>;
}

/** Signing in to a private deployment. */
export interface AccessService {
  /** Checks the session and renews it, so a phone in use stays signed in. Never throws. */
  check(): Promise<AccessState>;
  /** @throws Error when the passkey is cancelled or refused. */
  signIn(): Promise<void>;
  /** Adds a passkey with the invite code and signs in. @throws Error when anything fails. */
  register(inviteCode: string): Promise<void>;
}
