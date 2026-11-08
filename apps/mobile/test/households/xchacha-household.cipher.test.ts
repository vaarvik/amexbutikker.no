import { describe, expect, it } from 'vitest';
import { XchachaHouseholdCipher } from '../../src/households/xchacha-household.cipher';
import type { RandomBytesProvider } from '../../src/shared/shared.ports';
import { NodeRandomBytes } from './household-test.data';

class ZeroBytes implements RandomBytesProvider {
  public bytes(count: number): Uint8Array {
    return new Uint8Array(count);
  }
}

describe('XchachaHouseholdCipher', () => {
  const cipher = new XchachaHouseholdCipher(new NodeRandomBytes());

  it('opens what it sealed with the same key, and nothing with another', () => {
    const key = cipher.newKey();
    const sealed = cipher.seal(key, '{"amountNok":1299,"merchant":"Kafé Åsen"}');

    expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(sealed).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(sealed).not.toContain('1299');
    expect(cipher.open(key, sealed)).toBe('{"amountNok":1299,"merchant":"Kafé Åsen"}');
    expect(() => cipher.open(cipher.newKey(), sealed)).toThrow();
  });

  it('uses a fresh nonce for every record', () => {
    const key = cipher.newKey();

    expect(cipher.seal(key, 'same')).not.toBe(cipher.seal(key, 'same'));
  });

  it('refuses a changed, short or malformed record, and a key of the wrong size', () => {
    const key = cipher.newKey();
    const sealed = cipher.seal(key, 'tekst');
    const flipped = `${sealed.slice(0, -2)}${sealed.endsWith('AA') ? 'AB' : 'AA'}`;

    expect(() => cipher.open(key, flipped)).toThrow();
    expect(() => cipher.open(key, 'AAAA')).toThrow('too short');
    expect(() => cipher.open(key, 'not+base64url')).toThrow('base64url');
    expect(() => cipher.seal('AAAA', 'tekst')).toThrow('32 bytes');
  });

  it('derives the same join token from the same key, and it is not the key', () => {
    const fixed = new XchachaHouseholdCipher(new ZeroBytes());
    const key = fixed.newKey();

    expect(fixed.joinToken(key)).toBe(cipher.joinToken(key));
    expect(fixed.joinToken(key)).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(fixed.joinToken(key)).not.toBe(key);
    expect(cipher.joinToken(cipher.newKey())).not.toBe(fixed.joinToken(key));
  });
});
