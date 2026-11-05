import { IMPORT_SOURCES, ImportSourceSchema } from '@amexbutikker/contracts';
import { CompositionRoot } from './composition-root.js';

const HOUR_MS = 3_600_000;
const usage = [
  `Usage: import <${IMPORT_SOURCES.join(' | ')}> [--dry-run]`,
  '       refresh-statuses [--older-than-hours <n>]   (default 24)',
].join('\n');

// pnpm passes a literal "--" through when arguments follow `pnpm run <script> --`.
const [command, ...rest] = process.argv.slice(2).filter((arg) => arg !== '--');

if (command === 'import') {
  await runImport(rest);
} else if (command === 'refresh-statuses') {
  await refreshStatuses(rest);
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
