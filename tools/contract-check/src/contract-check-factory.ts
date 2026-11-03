import { TypeCheckerClassHeritage } from './class-heritage.js';
import { TsMorphContractChecker } from './contract-checker.js';
import type { ContractChecker } from './contract-checker.js';
import { ClassImplementsInterfaceRule } from './rules/class-implements-interface-rule.js';
import { ConstructionOutsideCompositionRootRule } from './rules/construction-outside-composition-root-rule.js';
import { ContractsClassRule } from './rules/contracts-class-rule.js';
import { ContractsFileNamingRule } from './rules/contracts-file-naming-rule.js';
import { ForbiddenImportRule } from './rules/forbidden-import-rule.js';
import { WorkspaceProjectLoader } from './workspace-project-loader.js';
import { RootRelativeWorkspacePaths } from './workspace-paths.js';

/** Creates a checker for a workspace root. Shared by the CLI and the tests. */
export interface ContractCheckerFactory {
  create(rootDir: string): ContractChecker;
}

export class DefaultContractCheckerFactory implements ContractCheckerFactory {
  public create(rootDir: string): ContractChecker {
    const heritage = new TypeCheckerClassHeritage();
    return new TsMorphContractChecker(
      new WorkspaceProjectLoader().load(rootDir),
      new RootRelativeWorkspacePaths(rootDir),
      [
        new ClassImplementsInterfaceRule(heritage),
        new ForbiddenImportRule(),
        new ConstructionOutsideCompositionRootRule(),
        new ContractsClassRule(heritage),
        new ContractsFileNamingRule(),
      ],
    );
  }
}
