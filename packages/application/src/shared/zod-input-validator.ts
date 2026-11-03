import { ValidationError } from '@amexbutikker/contracts';
import type { InputValidator } from '@amexbutikker/contracts';
import type { z } from 'zod';

export class ZodInputValidator implements InputValidator {
  public validate<T>(schema: z.ZodType<T>, input: unknown): T {
    const result = schema.safeParse(input);
    if (!result.success) {
      throw new ValidationError(
        'Invalid input.',
        result.error.issues.map((issue) => ({
          path: issue.path.filter((segment) => typeof segment !== 'symbol'),
          message: issue.message,
        })),
      );
    }
    return result.data;
  }
}
