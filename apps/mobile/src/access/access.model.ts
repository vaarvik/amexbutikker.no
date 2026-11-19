/**
 * Whether the app may be used:
 * - `open`: the API has no sign-in, or cannot be reached (the app works offline);
 * - `signed_in`: this browser holds a valid session, now renewed;
 * - `signed_out`: sign in with a passkey first.
 */
export type AccessState = 'open' | 'signed_in' | 'signed_out';
