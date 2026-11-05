import type { z } from 'zod';
import type { JsonRequest } from '../../src/shared/shared.model';
import type { JsonTransport } from '../../src/shared/shared.ports';

/** Records requests and answers each with the next queued response (or error), parsed by the schema. */
export class RecordingTransport implements JsonTransport {
  public readonly requests: JsonRequest[] = [];
  private readonly responses: unknown[] = [];

  public answer(...responses: unknown[]): this {
    this.responses.push(...responses);
    return this;
  }

  public request<T>(request: JsonRequest, schema: z.ZodType<T>): Promise<T> {
    this.requests.push(request);
    const next = this.responses.shift();
    if (next instanceof Error) {
      return Promise.reject(next);
    }
    return Promise.resolve(schema.parse(next));
  }
}
