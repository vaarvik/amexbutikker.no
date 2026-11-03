import { PgPlaceReader as Reader } from '../infrastructure/pg-place-reader.js';
import { GetPlaceUseCase } from '../../../../packages/application/src/index.js';

export interface HttpController {
  register(): void;
}

export class PlacesController implements HttpController {
  public register(): void {
    const reader = new Reader();
    const useCase = new GetPlaceUseCase();
    void reader;
    void useCase;
  }
}
