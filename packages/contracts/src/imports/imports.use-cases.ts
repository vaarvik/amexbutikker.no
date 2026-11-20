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

export interface SeedImportsInput {
  /** In the order they should run: places before the claims that point at them. */
  readonly sources: readonly ImportSource[];
}

export interface SeedImportsOutput {
  /** The runs started now, also the failed ones. */
  readonly reports: readonly ImportRunReport[];
  /** Sources that had already imported successfully, so they were left alone. */
  readonly skipped: readonly ImportSource[];
  /** Sources not run because one before them failed; the next seed tries them. */
  readonly pending: readonly ImportSource[];
}

/**
 * Fills a new database: runs each source that has never imported successfully, once. A failure
 * stops the seed, since later sources match against what earlier ones imported; the next seed
 * starts again from the failed source.
 */
export interface SeedImports {
  execute(input: SeedImportsInput): Promise<SeedImportsOutput>;
}
