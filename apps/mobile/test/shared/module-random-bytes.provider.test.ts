import { describe, expect, it } from 'vitest';
import { ModuleRandomBytesProvider } from '../../src/shared/module-random-bytes.provider';

describe('ModuleRandomBytesProvider', () => {
  it('passes on the bytes the module gives', () => {
    const provider = new ModuleRandomBytesProvider({
      getRandomBytes: (count) => new Uint8Array(count).fill(7),
    });

    expect(provider.bytes(3)).toEqual(new Uint8Array([7, 7, 7]));
  });

  it('refuses fewer bytes than asked for', () => {
    const provider = new ModuleRandomBytesProvider({ getRandomBytes: () => new Uint8Array(2) });

    expect(() => provider.bytes(3)).toThrow('got 2');
  });
});
