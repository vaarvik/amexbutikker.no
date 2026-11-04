import { IMPORT_SOURCES, ImportSourceSchema } from '@amexbutikker/contracts';
import { CompositionRoot } from './composition-root.js';

// Usage: cli import <source> [--dry-run]
const [command, source, ...flags] = process.argv.slice(2);
const usage = `Usage: import <${IMPORT_SOURCES.join(' | ')}> [--dry-run]`;
const parsedSource = ImportSourceSchema.safeParse(source);
const unknownFlags = flags.filter((flag) => flag !== '--dry-run');

if (command !== 'import' || !parsedSource.success || unknownFlags.length > 0) {
  console.error(usage);
  process.exitCode = 2;
} else {
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
