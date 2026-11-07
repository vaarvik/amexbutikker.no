import { DomainError } from '../shared/shared.errors.js';
import type { Place } from './places.model.js';

/** A user tried to add a place we already have. `existing` is the stored one. */
export class DuplicatePlaceError extends DomainError {
  public constructor(
    public readonly existing: Place,
    options?: ErrorOptions,
  ) {
    super('duplicate_place', `${existing.name} (${existing.id}) already exists.`, options);
  }
}
