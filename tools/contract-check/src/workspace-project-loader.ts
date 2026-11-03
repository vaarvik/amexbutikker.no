import path from 'node:path';
import { ModuleKind, ModuleResolutionKind, Project, ScriptTarget } from 'ts-morph';

/** Builds a ts-morph project covering the source files the rules apply to. */
export interface ProjectLoader {
  load(rootDir: string): Project;
}

export class WorkspaceProjectLoader implements ProjectLoader {
  public constructor(
    private readonly globs: readonly string[] = [
      'packages/*/src/**/*.{ts,tsx}',
      'packages/*/test-kit/**/*.{ts,tsx}',
      'packages/*/test/**/*.{ts,tsx}',
      'apps/api/src/**/*.{ts,tsx}',
      'apps/api/test/**/*.{ts,tsx}',
    ],
  ) {}

  public load(rootDir: string): Project {
    const project = new Project({
      skipAddingFilesFromTsConfig: true,
      compilerOptions: {
        target: ScriptTarget.ES2023,
        module: ModuleKind.NodeNext,
        moduleResolution: ModuleResolutionKind.NodeNext,
        customConditions: ['@amexbutikker/source'],
        strict: true,
        skipLibCheck: true,
        noEmit: true,
      },
    });
    project.addSourceFilesAtPaths([
      ...this.globs.map((glob) => path.join(rootDir, glob)),
      `!${path.join(rootDir, '**/node_modules/**')}`,
      `!${path.join(rootDir, '**/dist/**')}`,
    ]);
    return project;
  }
}
