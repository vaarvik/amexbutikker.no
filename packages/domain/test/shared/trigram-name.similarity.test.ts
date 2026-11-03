import { describe, expect, it } from 'vitest';
import { TrigramNameSimilarity } from '../../src/index.js';

describe('TrigramNameSimilarity', () => {
  const similarity = new TrigramNameSimilarity();

  it.each([
    ['Kafé Åsen', 'kafe asen'],
    ['  Grønland   Torg ', 'gronland torg'],
    ['Bjørn Ærlig', 'bjorn aerlig'],
    ['Crème Brûlée', 'creme brulee'],
    ['Søstrene GRENE', 'sostrene grene'],
  ])('normalises %j to %j', (input, expected) => {
    expect(similarity.normalize(input)).toBe(expected);
  });

  it('is idempotent', () => {
    const once = similarity.normalize('Ærlige Øl & Bår');
    expect(similarity.normalize(once)).toBe(once);
  });

  it('is 1 for texts that normalise to the same string', () => {
    expect(similarity.similarity('Kafé Åsen', 'KAFE ASEN')).toBe(1);
  });

  it('is 0 for texts without a shared trigram', () => {
    expect(similarity.similarity('abc', 'xyz')).toBe(0);
  });

  it('matches pg_trgm for a known pair', () => {
    // SELECT similarity('word', 'two words') = 0.36363637 in Postgres 16.
    expect(similarity.similarity('word', 'two words')).toBeCloseTo(4 / 11, 5);
  });

  it('ranks a closer spelling higher', () => {
    expect(similarity.similarity('Rema 1000 Grønland', 'rema 1000 gronland')).toBeGreaterThan(
      similarity.similarity('Rema 1000 Grønland', 'Remake Studio'),
    );
  });

  it('is 0 when either side is empty', () => {
    expect(similarity.similarity('', 'kafe')).toBe(0);
  });
});
