import type { PlaceId } from '../../contracts/src/ports.js';
import { NotFoundError } from '../../contracts/src/errors.js';

export interface Policy {
  weightFor(id: PlaceId): number;
}

export class DefaultPolicy implements Policy {
  public weightFor(id: PlaceId): number {
    if (id.length === 0) {
      throw new NotFoundError();
    }
    return 1;
  }
}
