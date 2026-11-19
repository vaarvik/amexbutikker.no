import { ConflictError, NotFoundError } from '@amexbutikker/contracts';
import type { Passkey, PasskeyId, PasskeyReader, PasskeyWriter } from '@amexbutikker/contracts';

/** Passkeys are not part of any unit of work, so they keep their own map. */
export class InMemoryPasskeyRepository implements PasskeyReader, PasskeyWriter {
  private readonly passkeys = new Map<PasskeyId, Passkey>();

  public findById(id: PasskeyId): Promise<Passkey | null> {
    return Promise.resolve(this.passkeys.get(id) ?? null);
  }

  public create(passkey: Passkey): Promise<void> {
    if (this.passkeys.has(passkey.id)) {
      return Promise.reject(new ConflictError('This passkey is already stored.'));
    }
    this.passkeys.set(passkey.id, passkey);
    return Promise.resolve();
  }

  public saveCounter(id: PasskeyId, counter: number): Promise<void> {
    const passkey = this.passkeys.get(id);
    if (passkey === undefined) {
      return Promise.reject(new NotFoundError('Passkey', id));
    }
    this.passkeys.set(id, { ...passkey, counter });
    return Promise.resolve();
  }
}
