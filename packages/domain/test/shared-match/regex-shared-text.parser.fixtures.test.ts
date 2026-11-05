import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ParsedSharedPlaceSchema } from '@amexbutikker/contracts';
import { describe, expect, it } from 'vitest';
import { RegexSharedTextParser } from '../../src/index.js';

// Checked-in share payloads (data/fixtures/shared): every `<case>.txt` must parse to
// `<case>.expected.json`. Adding a pair adds a test.
const dir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../data/fixtures/shared',
);
const cases = readdirSync(dir)
  .filter((file) => file.endsWith('.txt'))
  .map((file) => file.replace(/\.txt$/, ''));

describe('RegexSharedTextParser on shared fixtures', () => {
  it('has fixtures', () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  it.each(cases)('%s', (name) => {
    const text = readFileSync(path.join(dir, `${name}.txt`), 'utf8');
    const expected = ParsedSharedPlaceSchema.parse(
      JSON.parse(readFileSync(path.join(dir, `${name}.expected.json`), 'utf8')),
    );

    expect(new RegexSharedTextParser().parse(text)).toEqual(expected);
  });
});
