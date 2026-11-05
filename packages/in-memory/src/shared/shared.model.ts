export interface RateLimitRule {
  /** Actions allowed per window. */
  readonly limit: number;
  readonly windowSeconds: number;
}

export type RateLimitRules = Readonly<Record<string, RateLimitRule>>;
