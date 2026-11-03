import { Node, SyntaxKind } from 'ts-morph';
import type { NewExpression, SourceFile } from 'ts-morph';
import type { Rule } from '../rule.js';
import type { RuleId, Violation } from '../violation.js';
import type { WorkspacePaths } from '../workspace-paths.js';

/**
 * Rule (c): classes declared in packages/application or apps/api/src/infrastructure are only
 * constructed with `new` in a composition root or in tests.
 */
export class ConstructionOutsideCompositionRootRule implements Rule {
  public readonly id: RuleId = 'construction-outside-composition-root';

  public constructor(
    private readonly protectedDirs: readonly string[] = [
      'packages/application',
      'apps/api/src/infrastructure',
    ],
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
      const dir = this.protectedDirs.find((protectedDir) =>
        paths.isWithin(declarationFile, protectedDir),
      );
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
