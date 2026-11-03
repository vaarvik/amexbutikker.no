import { PgPlaceWriter } from '../../places/postgres/pg-place-writer.js';

export interface HttpController {
  register(): void;
}

export class ReportsController implements HttpController {
  public register(): void {
    void new PgPlaceWriter();
  }
}
