import type { AccessAuthenticator } from './shared.ports.js';

/** For a public deployment without Cloudflare Access: lets every request in. */
export class NullAccessAuthenticator implements AccessAuthenticator {
  public requireAccess(): Promise<void> {
    return Promise.resolve();
  }
}
