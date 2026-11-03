import path from 'node:path';
import type { SourceFile } from 'ts-morph';
import type { ClassHeritage } from '../type-checker-class.heritage.js';
import type { Rule } from '../rule.ports.js';
import type { RuleId, Violation } from '../violation.model.js';
import type { WorkspacePaths } from '../root-relative-workspace.paths.js';

/**
 * Rule (f): outside contracts, a file holds at most one exported class (Error subclasses aside)
 * and is named after it: kebab-case, with a dot before the role, e.g. `CreatePlaceUseCase` in
 * `create-place.use-case.ts`, `PgUnitOfWork` in `pg.unit-of-work.ts`. A file without a class is
 * `*.ports.ts` (interfaces) or `*.model.ts` (data types and constants).
 */
export class ClassFileNamingRule implements Rule {
  public readonly id: RuleId = 'class-file-naming';

  public constructor(
    private readonly heritage: ClassHeritage,
    private readonly scopes: readonly RegExp[] = [
      /^packages\/(domain|application|in-memory)\/src\//,
      /^apps\/api\/src\//,
      /^tools\/[^/]+\/src\//,
    ],
    private readonly roles: readonly string[] = [
      'use-case',
      'unit-of-work',
      'repository',
      'controller',
      'migration',
      'provider',
      'calculator',
      'policy',
      'selector',
      'summarizer',
      'decider',
      'similarity',
      'validator',
      'refresher',
      'mapper',
      'authenticator',
      'server',
      'importer',
      'parser',
      'matcher',
      'resolver',
      'generator',
      'clock',
      'logger',
      'rate-limiter',
      'translator',
      'factory',
      'service',
      'rule',
      'checker',
      'loader',
      'reporter',
      'heritage',
      'paths',
      'reader',
      'writer',
    ],
    private readonly classlessKinds: readonly string[] = ['ports', 'model'],
    private readonly exemptFiles: ReadonlySet<string> = new Set([
      'index.ts',
      'cli.ts',
      'server.ts',
      'migrate.ts',
      'composition-root.ts',
    ]),
  ) {}

  public check(sourceFile: SourceFile, paths: WorkspacePaths): readonly Violation[] {
    const filePath = sourceFile.getFilePath();
    const relativePath = paths.relative(filePath);
    const fileName = path.basename(filePath);
    if (
      !this.scopes.some((scope) => scope.test(relativePath)) ||
      paths.isTest(filePath) ||
      paths.isTestKit(filePath) ||
      this.exemptFiles.has(fileName)
    ) {
      return [];
    }

    const classes = sourceFile
      .getClasses()
      .filter((node) => node.isExported())
      .filter((node) => !this.heritage.extendsError(node));
    const violation = (line: number, message: string): Violation => ({
      ruleId: this.id,
      file: relativePath,
      line,
      message,
    });

    const [only, second] = classes;
    if (only === undefined) {
      const allowed = this.classlessKinds.map((kind) => `*.${kind}.ts`);
      return allowed.some((pattern) => fileName.endsWith(pattern.slice(1)))
        ? []
        : [violation(1, `A file without a class must be named ${allowed.join(' or ')}.`)];
    }
    if (second !== undefined) {
      return [
        violation(
          second.getStartLineNumber(),
          `One exported class per file; move ${second.getName() ?? '<anonymous>'} to its own file.`,
        ),
      ];
    }

    const problem = this.nameProblem(only.getName() ?? '', fileName);
    return problem === null ? [] : [violation(only.getStartLineNumber(), problem)];
  }

  private nameProblem(className: string, fileName: string): string | null {
    const kebab = className
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
      .toLowerCase();
    const role = this.roles.find(
      (candidate) => kebab === candidate || kebab.endsWith(`-${candidate}`),
    );
    if (role === undefined) {
      return `Class ${className} must end in a known role (${this.roles.join(', ')}).`;
    }
    const prefix = kebab.slice(0, kebab.length - role.length - 1);
    const expected = prefix.length === 0 ? `${role}.ts` : `${prefix}.${role}.ts`;
    return fileName === expected ? null : `Class ${className} must live in "${expected}".`;
  }
}
