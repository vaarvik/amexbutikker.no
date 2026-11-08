import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import type { RandomBytesProvider } from '../shared/shared.ports';
import type { HouseholdCipher } from './households.ports';

const KEY_BYTES = 32;
const NONCE_BYTES = 24;
const JOIN_TOKEN_INFO = new TextEncoder().encode('amexbutikker household join v1');

/**
 * XChaCha20-Poly1305 with a random 24-byte nonce per record (large enough that random nonces do
 * not repeat), the nonce stored in front of the ciphertext. The join token is HKDF-SHA256 of the
 * key with its own label, so it cannot be turned back into the key.
 */
export class XchachaHouseholdCipher implements HouseholdCipher {
  public constructor(private readonly random: RandomBytesProvider) {}

  public newKey(): string {
    return this.encode(this.random.bytes(KEY_BYTES));
  }

  public seal(key: string, plaintext: string): string {
    const nonce = this.random.bytes(NONCE_BYTES);
    const sealed = xchacha20poly1305(this.key(key), nonce).encrypt(
      new TextEncoder().encode(plaintext),
    );
    const out = new Uint8Array(nonce.length + sealed.length);
    out.set(nonce);
    out.set(sealed, nonce.length);
    return this.encode(out);
  }

  public open(key: string, sealed: string): string {
    const bytes = this.decode(sealed);
    if (bytes.length <= NONCE_BYTES) {
      throw new Error('The record is too short.');
    }
    const plain = xchacha20poly1305(this.key(key), bytes.subarray(0, NONCE_BYTES)).decrypt(
      bytes.subarray(NONCE_BYTES),
    );
    return new TextDecoder().decode(plain);
  }

  public joinToken(key: string): string {
    return this.encode(hkdf(sha256, this.key(key), undefined, JOIN_TOKEN_INFO, 32));
  }

  private key(key: string): Uint8Array {
    const bytes = this.decode(key);
    if (bytes.length !== KEY_BYTES) {
      throw new Error('A household key is 32 bytes.');
    }
    return bytes;
  }

  /** base64url without padding. */
  private encode(bytes: Uint8Array): string {
    let binary = '';
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  private decode(text: string): Uint8Array {
    if (!/^[A-Za-z0-9_-]*$/.test(text)) {
      throw new Error('Not base64url.');
    }
    const padded =
      text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4);
    return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
  }
}
