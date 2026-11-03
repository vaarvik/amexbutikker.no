import type { PlaceReader } from '../../../../packages/contracts/src/ports.js';

export class PgPlaceReader implements PlaceReader {
  public getById(): Promise<unknown> {
    return Promise.resolve(null);
  }
}

export class PgConnectionError extends Error {}
