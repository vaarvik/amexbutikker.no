import { IMPORT_SOURCES, ImportSourceSchema } from '@amexbutikker/contracts';
import { CompositionRoot } from './composition-root.js';

const HOUR_MS = 3_600_000;
/** Places first, then the claims that point at them. */
const SEED_SOURCES = ['osm_overpass', 'brreg_underenheter', 'curated_list'] as const;
const SEED_ATTEMPTS = 6;
const SEED_RETRY_MS = 5 * 60_000;
const usage = [
  `Usage: import <${IMPORT_SOURCES.join(' | ')}> [--dry-run]`,
  '       refresh-statuses [--older-than-hours <n>]   (default 24)',
  '       seed   (imports each source once, into a new database)',
].join('\n');

// pnpm passes a literal "--" through when arguments follow `pnpm run <script> --`.
const [command, ...rest] = process.argv.slice(2).filter((arg) => arg !== '--');

if (command === 'import') {
  await runImport(rest);
} else if (command === 'refresh-statuses') {
  await refreshStatuses(rest);
} else if (command === 'seed' && rest.length === 0) {
  await seed();
} else {
  console.error(usage);
  process.exitCode = 2;
}

async function runImport(args: readonly string[]): Promise<void> {
  const [source, ...flags] = args;
  const parsedSource = ImportSourceSchema.safeParse(source);
  if (!parsedSource.success || flags.some((flag) => flag !== '--dry-run')) {
    console.error(usage);
    process.exitCode = 2;
    return;
  }
  const root = CompositionRoot.fromEnv(process.env);
  try {
    const report = await root.runImport.execute({
      source: parsedSource.data,
      dryRun: flags.includes('--dry-run'),
    });
    const seconds = (report.finishedAt.getTime() - report.startedAt.getTime()) / 1000;
    console.log(
      `${report.source} ${report.status}${report.dryRun ? ' (dry run, nothing written)' : ''} in ${seconds.toFixed(1)} s, run ${report.runId}`,
    );
    console.log(`fetched at ${report.fetchedAt?.toISOString() ?? 'n/a'}`);
    console.table(report.counts);
    if (Object.keys(report.metrics).length > 0) {
      console.table(report.metrics);
    }
    for (const message of report.messages) {
      console.log(`  ${message}`);
    }
    if (report.status === 'failed') {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await root.close();
  }
}

/**
 * Fills a new database. A failed import (Overpass is often busy) is retried a few minutes later,
 * up to `SEED_ATTEMPTS` times; after that the next start tries again.
 */
async function seed(): Promise<void> {
  const root = CompositionRoot.fromEnv(process.env);
  try {
    for (let attempt = 1; attempt <= SEED_ATTEMPTS; attempt += 1) {
      const { reports, skipped, pending } = await root.seedImports.execute({
        sources: SEED_SOURCES,
      });
      if (skipped.length > 0) {
        console.log(`seed: already imported: ${skipped.join(', ')}`);
      }
      for (const report of reports) {
        console.log(`seed: ${report.source} ${report.status}`, JSON.stringify(report.counts));
        if (report.status === 'failed') {
          console.log(`  ${report.messages.slice(0, 3).join('\n  ')}`);
        }
      }
      if (!reports.some((report) => report.status === 'failed')) {
        return;
      }
      console.log(`seed: attempt ${String(attempt)} stopped; waiting: ${pending.join(', ')}`);
      if (attempt < SEED_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, SEED_RETRY_MS));
      }
    }
    process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await root.close();
  }
}

/** Recalculates statuses not calculated within the last n hours. Meant to run nightly. */
async function refreshStatuses(args: readonly string[]): Promise<void> {
  const [flag, value] = args;
  const hours = flag === undefined ? 24 : flag === '--older-than-hours' ? Number(value) : NaN;
  if (!Number.isFinite(hours) || hours < 0 || args.length > 2) {
    console.error(usage);
    process.exitCode = 2;
    return;
  }
  const root = CompositionRoot.fromEnv(process.env);
  try {
    const started = Date.now();
    const { refreshed } = await root.refreshStaleStatuses.execute({
      calculatedBefore: new Date(started - hours * HOUR_MS),
      batchSize: 200,
    });
    console.log(
      `refreshed ${String(refreshed)} statuses in ${((Date.now() - started) / 1000).toFixed(1)} s`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await root.close();
  }
}
