import type { PlaceId } from '../../contracts/src/places/places.ports.js';
import { NotFoundError } from '../../contracts/src/shared/shared.errors.js';

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
