import { describe, expect, it } from 'vitest';
import { NullAccessAuthenticator } from '../../src/shared/null-access.authenticator.js';

describe('NullAccessAuthenticator', () => {
  it('lets every request in', async () => {
    await expect(new NullAccessAuthenticator().requireAccess()).resolves.toBeUndefined();
  });
});
