import type { IdGenerator } from './spending.ports';

/** Random ids from `crypto.randomUUID` where the runtime has it, otherwise time plus random. */
export class RandomIdGenerator implements IdGenerator {
  public constructor(private readonly random: () => number = Math.random) {}

  public next(): string {
    // Not every React Native runtime has Web Crypto, whatever the DOM types say.
    const crypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    if (crypto?.randomUUID !== undefined) {
      return crypto.randomUUID();
    }
    const part = () => Math.floor(this.random() * 0x1_0000_0000).toString(36);
    return `${Date.now().toString(36)}-${part()}-${part()}`;
  }
}
