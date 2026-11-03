import type { PlaceReader } from '../../../../../packages/contracts/src/ports.js';

export class PgPlaceWriter implements PlaceReader {
  public getById(): Promise<unknown> {
    return Promise.resolve(null);
  }
}
