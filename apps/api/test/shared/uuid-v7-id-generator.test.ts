import { PlaceIdSchema } from '@amexbutikker/contracts';
import { describe, expect, it } from 'vitest';
import { UuidV7IdGenerator } from '../../src/shared/infrastructure/uuid-v7-id-generator.js';

describe('UuidV7IdGenerator', () => {
  it('generates valid, unique version 7 UUIDs that sort by time', () => {
    let now = Date.parse('2026-11-03T12:00:00Z');
    const ids = new UuidV7IdGenerator({ now: () => new Date((now += 1)) });

    const generated = Array.from({ length: 200 }, () => ids.placeId());

    expect(new Set(generated).size).toBe(200);
    expect(generated.every((id) => PlaceIdSchema.safeParse(id).success)).toBe(true);
    expect(
      generated.every((id) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id),
      ),
    ).toBe(true);
    expect([...generated].sort()).toEqual(generated);
  });

  it('encodes the timestamp in the first 48 bits', () => {
    const ms = Date.parse('2026-11-03T12:00:00Z');
    const id = new UuidV7IdGenerator({ now: () => new Date(ms) }).userId();

    expect(Number.parseInt(id.replace(/-/g, '').slice(0, 12), 16)).toBe(ms);
  });
});
