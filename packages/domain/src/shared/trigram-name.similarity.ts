import type { NameSimilarity } from '@amexbutikker/contracts';

const COMBINING_MARKS = /\p{M}/gu;
const NON_DECOMPOSING_LETTERS: Readonly<Record<string, string>> = {
  ø: 'o',
  æ: 'ae',
  đ: 'd',
  ł: 'l',
  ß: 'ss',
};
const WORD = /[\p{L}\p{N}]+/gu;

/**
 * pg_trgm-compatible trigram similarity over unaccented, lowercased text. Words are padded with
 * two leading spaces and one trailing space, and similarity is shared trigrams over all distinct
 * trigrams, as in Postgres.
 */
export class TrigramNameSimilarity implements NameSimilarity {
  public normalize(text: string): string {
    return Object.entries(NON_DECOMPOSING_LETTERS)
      .reduce(
        (lower, [letter, replacement]) => lower.replaceAll(letter, replacement),
        text.toLowerCase(),
      )
      .normalize('NFD')
      .replace(COMBINING_MARKS, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  public similarity(a: string, b: string): number {
    const left = this.trigrams(a);
    const right = this.trigrams(b);
    if (left.size === 0 || right.size === 0) {
      return 0;
    }
    let shared = 0;
    for (const trigram of left) {
      if (right.has(trigram)) {
        shared += 1;
      }
    }
    return shared / (left.size + right.size - shared);
  }

  private trigrams(text: string): Set<string> {
    const trigrams = new Set<string>();
    for (const [word] of this.normalize(text).matchAll(WORD)) {
      const padded = `  ${word} `;
      for (let i = 0; i + 3 <= padded.length; i += 1) {
        trigrams.add(padded.slice(i, i + 3));
      }
    }
    return trigrams;
  }
}
