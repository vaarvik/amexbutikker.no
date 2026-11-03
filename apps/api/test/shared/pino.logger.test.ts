import { Writable } from 'node:stream';
import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { PinoLogger } from '../../src/shared/pino.logger.js';

describe('PinoLogger', () => {
  it('writes every level with its message and fields', () => {
    const lines: Record<string, unknown>[] = [];
    const sink = new Writable({
      write(chunk: Buffer, _encoding, done) {
        lines.push(JSON.parse(chunk.toString()) as Record<string, unknown>);
        done();
      },
    });
    const logger = new PinoLogger(pino({ level: 'debug' }, sink));

    logger.debug('d', { a: 1 });
    logger.info('i');
    logger.warn('w', { b: 2 });
    logger.error('e');

    expect(lines.map(({ level, msg, a, b }) => ({ level, msg, a, b }))).toEqual([
      { level: 20, msg: 'd', a: 1, b: undefined },
      { level: 30, msg: 'i', a: undefined, b: undefined },
      { level: 40, msg: 'w', a: undefined, b: 2 },
      { level: 50, msg: 'e', a: undefined, b: undefined },
    ]);
  });
});
