import { afterEach, describe, expect, it, vi } from 'vitest';
import { RandomIdGenerator } from '../../src/spending/random-id.generator';

describe('RandomIdGenerator', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses crypto.randomUUID when the runtime has it', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'uuid-1' });

    expect(new RandomIdGenerator().next()).toBe('uuid-1');
  });

  it('falls back to time plus random parts, different each time', () => {
    vi.stubGlobal('crypto', undefined);
    let seed = 0;
    const ids = new RandomIdGenerator(() => (seed += 0.1));

    const first = ids.next();
    const second = ids.next();

    expect(first).toMatch(/^[0-9a-z]+-[0-9a-z]+-[0-9a-z]+$/);
    expect(second).not.toBe(first);
  });
});
