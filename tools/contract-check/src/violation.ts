export type RuleId =
  | 'class-implements-interface'
  | 'forbidden-import'
  | 'construction-outside-composition-root'
  | 'contracts-class';

export interface Violation {
  readonly ruleId: RuleId;
  /** Path relative to the checked root, with forward slashes. */
  readonly file: string;
  readonly line: number;
  readonly message: string;
}
