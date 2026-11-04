import type {
  Clock,
  ImportContext,
  ImportCounts,
  ImportRunReport,
  SourceImporter,
  UnmatchedDescriptorWriter,
} from '@amexbutikker/contracts';
import type { TextFileLoader } from '../../imports.ports.js';
import type { MerchantDescriptorMatcher, StatementParser } from './statement.ports.js';

export interface StatementImporterConfig {
  readonly path: string;
}

type Tally = { -readonly [K in keyof ImportCounts]: ImportCounts[K] };

/**
 * Skeleton. Parses a card statement and matches each merchant descriptor to a place.
 * Unmatched descriptors go to the review queue and never create evidence. Matched lines are
 * only counted: transaction evidence needs the paying user, which comes with phase 8.
 *
 * Counts: `read` is statement lines, `created` / `updated` / `unchanged` are review-queue
 * outcomes, `skipped` is matched lines. A dry run writes nothing to the queue and counts every
 * unmatched line as `created`, since the queue is not transactional.
 */
export class StatementImporter implements SourceImporter {
  public readonly source = 'statement';

  public constructor(
    private readonly files: TextFileLoader,
    private readonly parser: StatementParser,
    private readonly matcher: MerchantDescriptorMatcher,
    private readonly review: UnmatchedDescriptorWriter,
    private readonly clock: Clock,
    private readonly config: StatementImporterConfig,
  ) {}

  public async run(context: ImportContext): Promise<ImportRunReport> {
    context.signal?.throwIfAborted();
    const messages: string[] = [];
    const counts: Tally = {
      read: 0,
      created: 0,
      updated: 0,
      unchanged: 0,
      skipped: 0,
      failed: 0,
      evidenceAppended: 0,
    };
    const report = (status: ImportRunReport['status']): ImportRunReport => ({
      runId: context.runId,
      source: this.source,
      dryRun: context.dryRun,
      status,
      startedAt: context.startedAt,
      finishedAt: this.clock.now(),
      fetchedAt: null,
      counts,
      metrics: { matched: counts.skipped },
      messages,
    });

    try {
      const lines = this.parser.parse(await this.files.load(this.config.path));
      for (const line of lines) {
        context.signal?.throwIfAborted();
        counts.read += 1;
        if ((await this.matcher.match(line.descriptor)) !== null) {
          counts.skipped += 1;
          continue;
        }
        if (context.dryRun) {
          counts.created += 1;
          continue;
        }
        counts[await this.review.record(line.descriptor, line.postedOn)] += 1;
      }
      if (counts.skipped > 0) {
        messages.push(
          `${String(counts.skipped)} matched lines were not turned into evidence: transaction evidence needs the paying user.`,
        );
      }
      return report('succeeded');
    } catch (error) {
      if (context.signal?.aborted === true) {
        throw context.signal.reason;
      }
      messages.push(error instanceof Error ? error.message : 'The import threw a non-error value.');
      return report('failed');
    }
  }
}
