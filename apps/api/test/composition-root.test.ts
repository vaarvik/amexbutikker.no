import { describe, expect, it } from 'vitest';
import { ApiConfigSchema } from '../src/composition-root.js';

const base = {
  storage: 'memory',
  deviceTokenSecret: 'test-secret-that-is-at-least-32-characters',
  imports: {},
};

describe('ApiConfigSchema', () => {
  it('disables CORS by default', () => {
    expect(ApiConfigSchema.parse(base).corsOrigins).toEqual([]);
  });

  it('reads a comma-separated list of exact origins', () => {
    expect(
      ApiConfigSchema.parse({
        ...base,
        corsOrigins: ' http://localhost:8081 , https://abc.trycloudflare.com,',
      }).corsOrigins,
    ).toEqual(['http://localhost:8081', 'https://abc.trycloudflare.com']);
  });

  it.each([['*'], ['https://*.trycloudflare.com'], ['http://localhost:8081/'], ['localhost:8081']])(
    'rejects %s',
    (corsOrigins) => {
      expect(ApiConfigSchema.safeParse({ ...base, corsOrigins }).success).toBe(false);
    },
  );
});
