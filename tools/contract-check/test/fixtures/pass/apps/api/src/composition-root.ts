import { SearchPlacesUseCase } from '../../../packages/application/src/search-places-use-case.js';
import { PgPlaceReader } from './infrastructure/pg-place-reader.js';

export class CompositionRoot {
  public readonly searchPlaces = new SearchPlacesUseCase(new PgPlaceReader());
}
