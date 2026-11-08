import { createHash } from 'node:crypto';
import type { JoinTokenHasher } from '@amexbutikker/contracts';

export class Sha256JoinTokenHasher implements JoinTokenHasher {
  public hash(joinToken: string): string {
    return createHash('sha256').update(joinToken).digest('hex');
  }
}
