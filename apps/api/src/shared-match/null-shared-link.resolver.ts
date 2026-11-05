import type { ResolvedSharedLink, SharedLinkResolver } from '@amexbutikker/contracts';

/**
 * Resolves nothing. Following maps short links (maps.app.goo.gl) would mean calling Google,
 * which this iteration does not do; matching works from the shared text alone.
 */
export class NullSharedLinkResolver implements SharedLinkResolver {
  public resolve(): Promise<ResolvedSharedLink | null> {
    return Promise.resolve(null);
  }
}
