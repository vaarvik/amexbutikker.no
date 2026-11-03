import type { SourceFile } from 'ts-morph';
import type { ClassHeritage } from '../class-heritage.js';
import type { Rule } from '../rule.js';
import type { RuleId, Violation } from '../violation.js';
import type { WorkspacePaths } from '../workspace-paths.js';

/**
 * Rule (a): every exported class in packages/application and apps/api/src implements
 * at least one interface. The composition root, tests and Error subclasses are exempt.
 */
export class ClassImplementsInterfaceRule implements Rule {
  public readonly id: RuleId = 'class-implements-interface';

  public constructor(
    private readonly heritage: ClassHeritage,
    private readonly scopes: readonly string[] = ['packages/application', 'apps/api/src'],
  ) {}

  public check(sourceFile: SourceFile, paths: WorkspacePaths): readonly Violation[] {
    const filePath = sourceFile.getFilePath();
    if (
      !this.scopes.some((scope) => paths.isWithin(filePath, scope)) ||
      paths.isTest(filePath) ||
      paths.isCompositionRoot(filePath)
    ) {
      return [];
    }

    return sourceFile
      .getClasses()
      .filter((node) => node.isExported())
      .filter((node) => !this.heritage.extendsError(node))
      .filter((node) => !this.heritage.implementsAnInterface(node))
      .map((node) => ({
        ruleId: this.id,
        file: paths.relative(filePath),
        line: node.getStartLineNumber(),
        message: `Exported class ${node.getName() ?? '<anonymous>'} must implement at least one interface.`,
      }));
  }
}
