import type { RandomBytesModule, RandomBytesProvider } from './shared.ports';

/** Random bytes from expo-crypto (or Web Crypto on the web), checked for length. */
export class ModuleRandomBytesProvider implements RandomBytesProvider {
  public constructor(private readonly module: RandomBytesModule) {}

  public bytes(count: number): Uint8Array {
    const bytes = this.module.getRandomBytes(count);
    if (bytes.length !== count) {
      throw new Error(`Asked for ${String(count)} random bytes, got ${String(bytes.length)}.`);
    }
    return bytes;
  }
}
