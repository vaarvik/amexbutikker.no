import { Node, SyntaxKind } from 'ts-morph';
import type { NewExpression, SourceFile } from 'ts-morph';
import type { Rule } from '../rule.js';
import type { RuleId, Violation } from '../violation.js';
import type { WorkspacePaths } from '../workspace-paths.js';

/**
 * Rule (c): application classes and infrastructure classes are only constructed with `new` in a
 * composition root or in tests. Application classes live in packages/application. Infrastructure
 * classes live in apps/api/src under any folder named after a mechanism, e.g.
 * `apps/api/src/places/postgres/` or `apps/api/src/imports/importers/`.
 */
export class ConstructionOutsideCompositionRootRule implements Rule {
  public readonly id: RuleId = 'construction-outside-composition-root';

  public constructor(
    private readonly protectedDirs: readonly string[] = ['packages/application'],
    private readonly infrastructureRoot = 'apps/api/src',
    private readonly infrastructureSegments: ReadonlySet<string> = new Set([
      'infrastructure',
      'postgres',
      'in-memory',
      'importers',
      'http',
    ]),
  ) {}

  public check(sourceFile: SourceFile, paths: WorkspacePaths): readonly Violation[] {
    const filePath = sourceFile.getFilePath();
    if (paths.isTest(filePath) || paths.isCompositionRoot(filePath)) {
      return [];
    }

    const violations: Violation[] = [];
    for (const expression of sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression)) {
      const declarationFile = this.declarationFileOf(expression);
      if (declarationFile === undefined) {
        continue;
      }
      const dir = this.protectedLocationOf(declarationFile, paths);
      if (dir !== undefined) {
        violations.push({
          ruleId: this.id,
          file: paths.relative(filePath),
          line: expression.getStartLineNumber(),
          message: `"new ${expression.getExpression().getText()}" constructs a class from ${dir}; only a composition root or a test may do that.`,
        });
      }
    }
    return violations;
  }

  private protectedLocationOf(filePath: string, paths: WorkspacePaths): string | undefined {
    const dir = this.protectedDirs.find((protectedDir) => paths.isWithin(filePath, protectedDir));
    if (dir !== undefined) {
      return dir;
    }
    if (!paths.isWithin(filePath, this.infrastructureRoot)) {
      return undefined;
    }
    const segments = paths.relative(filePath).split('/').slice(0, -1);
    const segment = segments.find((name) => this.infrastructureSegments.has(name));
    return segment === undefined ? undefined : `${this.infrastructureRoot}/**/${segment}`;
  }

  private declarationFileOf(expression: NewExpression): string | undefined {
    const symbol = expression.getExpression().getSymbol();
    if (symbol === undefined) {
      return undefined;
    }
    const target = symbol.isAlias() ? (symbol.getAliasedSymbol() ?? symbol) : symbol;
    const declaration = target
      .getDeclarations()
      .find((node) => Node.isClassDeclaration(node) || Node.isClassExpression(node));
    return declaration?.getSourceFile().getFilePath();
  }
}
