import type { ImportRunReport, ImportSource } from './imports.model.js';

export interface RunImportInput {
  readonly source: ImportSource;
  readonly dryRun: boolean;
}

/** Runs one SourceImporter and records the run in `import_runs`. */
export interface RunImport {
  /**
   * @returns the importer's report, also when it failed.
   * @throws NotFoundError when no importer is registered for the source.
   */
  execute(input: RunImportInput): Promise<ImportRunReport>;
}
