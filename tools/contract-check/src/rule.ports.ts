import type { SourceFile } from 'ts-morph';
import type { WorkspacePaths } from './root-relative-workspace.paths.js';
import type { RuleId, Violation } from './violation.model.js';

/** One architecture rule, checked one source file at a time. */
export interface Rule {
  readonly id: RuleId;
  check(sourceFile: SourceFile, paths: WorkspacePaths): readonly Violation[];
}
