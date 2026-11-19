/**
 * The session cookie. `__Host-` makes browsers refuse it unless it is Secure, on `/` and without
 * a Domain, so no other host can set or read it.
 */
export const ACCESS_SESSION_COOKIE = '__Host-amex_session';
