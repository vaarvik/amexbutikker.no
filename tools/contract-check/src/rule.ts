import type { SourceFile } from 'ts-morph';
import type { WorkspacePaths } from './workspace-paths.js';
import type { RuleId, Violation } from './violation.js';

/** One architecture rule, checked one source file at a time. */
export interface Rule {
  readonly id: RuleId;
  check(sourceFile: SourceFile, paths: WorkspacePaths): readonly Violation[];
}
