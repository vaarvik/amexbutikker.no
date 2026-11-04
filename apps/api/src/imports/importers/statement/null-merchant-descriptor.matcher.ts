import type { PlaceId } from '@amexbutikker/contracts';
import type { MerchantDescriptorMatcher } from './statement.ports.js';

/** Matches nothing, so every descriptor goes to review. The skeleton's default. */
export class NullMerchantDescriptorMatcher implements MerchantDescriptorMatcher {
  public match(): Promise<PlaceId | null> {
    return Promise.resolve(null);
  }
}
