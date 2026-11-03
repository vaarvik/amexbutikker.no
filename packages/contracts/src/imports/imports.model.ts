import { z } from 'zod';
import { ImportRunIdSchema } from '../shared/shared.model.js';
import type { ImportRunId } from '../shared/shared.model.js';

/** Identifies a SourceImporter. */
export type ImportSource = 'osm_overpass' | 'curated_list' | 'brreg_underenheter' | 'statement';
export const IMPORT_SOURCES = [
  'osm_overpass',
  'curated_list',
  'brreg_underenheter',
  'statement',
] as const satisfies readonly ImportSource[];
export const ImportSourceSchema: z.ZodType<ImportSource> = z.enum(IMPORT_SOURCES);

export type ImportRunStatus = 'succeeded' | 'failed';

/** Counters every importer reports. Records are whatever unit the source has (OSM element, claim, row). */
export interface ImportCounts {
  readonly read: number;
  readonly created: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly skipped: number;
  readonly failed: number;
  readonly evidenceAppended: number;
}

export const ImportCountsSchema: z.ZodType<ImportCounts> = z.object({
  read: z.int().nonnegative(),
  created: z.int().nonnegative(),
  updated: z.int().nonnegative(),
  unchanged: z.int().nonnegative(),
  skipped: z.int().nonnegative(),
  failed: z.int().nonnegative(),
  evidenceAppended: z.int().nonnegative(),
});

/** The outcome of one import run, as stored in `import_runs`. */
export interface ImportRunReport {
  readonly runId: ImportRunId;
  readonly source: ImportSource;
  readonly dryRun: boolean;
  readonly status: ImportRunStatus;
  readonly startedAt: Date;
  readonly finishedAt: Date;
  /** When the source data was fetched (e.g. Overpass response time, claim file date). */
  readonly fetchedAt: Date | null;
  readonly counts: ImportCounts;
  /** Source-specific numbers, e.g. `{ brregMatchRate: 0.62 }`. */
  readonly metrics: Readonly<Record<string, number>>;
  /** Human-readable warnings and the failure reason, if any. */
  readonly messages: readonly string[];
}

export const ImportRunReportSchema: z.ZodType<ImportRunReport> = z.object({
  runId: ImportRunIdSchema,
  source: ImportSourceSchema,
  dryRun: z.boolean(),
  status: z.enum(['succeeded', 'failed']),
  startedAt: z.date(),
  finishedAt: z.date(),
  fetchedAt: z.date().nullable(),
  counts: ImportCountsSchema,
  metrics: z.record(z.string(), z.number()),
  messages: z.array(z.string()),
});
