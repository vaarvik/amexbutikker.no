import type { SharedLinkResolver } from '@amexbutikker/contracts';
import { describe, expect, it } from 'vitest';
import { NullSharedLinkResolver } from '../../src/shared-match/null-shared-link.resolver.js';

describe('NullSharedLinkResolver', () => {
  it('resolves nothing, so no link is ever followed', async () => {
    const resolver: SharedLinkResolver = new NullSharedLinkResolver();

    await expect(resolver.resolve('https://maps.app.goo.gl/abc')).resolves.toBeNull();
  });
});
