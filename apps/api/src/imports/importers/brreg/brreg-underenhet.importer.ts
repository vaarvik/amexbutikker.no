import type {
  Clock,
  ImportContext,
  ImportCounts,
  ImportRunReport,
  PlaceId,
  SourceImporter,
  TransactionalPorts,
} from '@amexbutikker/contracts';
import type { ImportUnitOfWork } from '../../imports.ports.js';
import { BrregUnderenhetRowSchema, IMPORTED_NACE_PREFIXES } from './brreg.model.js';
import type { BrregUnderenhet } from './brreg.model.js';
import type { BrregPlaceMatcher, BrregUnderenhetReader } from './brreg.ports.js';

export interface BrregUnderenhetImporterConfig {
  readonly kommunenummer: string;
  readonly maxMessages: number;
}

type Tally = { -readonly [K in keyof ImportCounts]: ImportCounts[K] };

/**
 * Attaches Brønnøysund organisation numbers to existing places. Reads the underenhet bulk file,
 * keeps open units in one kommune whose main NACE code is retail, hotel or food service, and
 * matches each to a place by postcode, street and name. Never creates places.
 *
 * Counts: `read` is units in scope, `updated` places that got an orgnr, `unchanged` places that
 * already had it, `skipped` units without a match. The match rate is matched / in scope.
 */
export class BrregUnderenhetImporter implements SourceImporter {
  public readonly source = 'brreg_underenheter';

  public constructor(
    private readonly reader: BrregUnderenhetReader,
    private readonly matcher: BrregPlaceMatcher,
    private readonly unitOfWork: ImportUnitOfWork,
    private readonly clock: Clock,
    private readonly config: BrregUnderenhetImporterConfig,
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
    let fetchedAt: Date | null = null;
    let rowsScanned = 0;
    const report = (status: ImportRunReport['status']): ImportRunReport => {
      const matched = counts.updated + counts.unchanged;
      return {
        runId: context.runId,
        source: this.source,
        dryRun: context.dryRun,
        status,
        startedAt: context.startedAt,
        finishedAt: this.clock.now(),
        fetchedAt,
        counts: status === 'succeeded' ? counts : { ...counts, updated: 0, unchanged: 0 },
        metrics:
          status === 'succeeded'
            ? { rowsScanned, matched, matchRate: counts.read === 0 ? 0 : matched / counts.read }
            : { rowsScanned },
        messages: this.capped(messages),
      };
    };

    try {
      const file = await this.reader.open(context.signal);
      fetchedAt = file.fetchedAt;
      const byPostcode = new Map<string, BrregUnderenhet[]>();
      for await (const row of file.rows) {
        rowsScanned += 1;
        if (!this.inScope(row)) {
          continue;
        }
        counts.read += 1;
        const unit = BrregUnderenhetRowSchema.safeParse(row);
        if (!unit.success) {
          counts.failed += 1;
          messages.push(
            `row ${String(rowsScanned)} is invalid: ${unit.error.issues[0]?.message ?? ''}`,
          );
          continue;
        }
        if (unit.data.postcode === null) {
          counts.skipped += 1;
          messages.push(`${unit.data.orgnr} ${unit.data.name}: has no postcode`);
          continue;
        }
        byPostcode.set(unit.data.postcode, [
          ...(byPostcode.get(unit.data.postcode) ?? []),
          unit.data,
        ]);
      }
      await this.unitOfWork.run(context.dryRun, (ports) =>
        this.attach(byPostcode, ports, context, counts, messages),
      );
      return report('succeeded');
    } catch (error) {
      if (context.signal?.aborted === true) {
        throw context.signal.reason;
      }
      messages.push(error instanceof Error ? error.message : 'The import threw a non-error value.');
      return report('failed');
    }
  }

  /** Cheap filter on the raw row, before validation, since the file covers all of Norway. */
  private inScope(row: Readonly<Record<string, string>>): boolean {
    const nace = row['naeringskode1.kode'] ?? '';
    return (
      row['beliggenhetsadresse.kommunenummer'] === this.config.kommunenummer &&
      (row.nedleggelsesdato ?? '') === '' &&
      IMPORTED_NACE_PREFIXES.some((prefix) => nace.startsWith(prefix))
    );
  }

  private async attach(
    byPostcode: ReadonlyMap<string, readonly BrregUnderenhet[]>,
    ports: TransactionalPorts,
    context: ImportContext,
    counts: Tally,
    messages: string[],
  ): Promise<void> {
    const attached = new Map<PlaceId, string>();
    for (const [postcode, units] of byPostcode) {
      context.signal?.throwIfAborted();
      const candidates = await ports.places.listByPostcode(postcode);
      for (const unit of units) {
        const match = this.matcher.match(unit, candidates);
        if (match.kind === 'unmatched') {
          counts.skipped += 1;
          messages.push(`${unit.orgnr} ${unit.name}: ${match.reason}`);
          continue;
        }
        const { place } = match;
        const claimedBy = attached.get(place.id);
        if (
          claimedBy !== undefined ||
          (place.brregOrgnr !== null && place.brregOrgnr !== unit.orgnr)
        ) {
          counts.skipped += 1;
          messages.push(
            `${unit.orgnr} ${unit.name}: ${place.name} already has orgnr ${claimedBy ?? place.brregOrgnr ?? ''}`,
          );
          continue;
        }
        attached.set(place.id, unit.orgnr);
        if (place.brregOrgnr === unit.orgnr) {
          counts.unchanged += 1;
          continue;
        }
        await ports.places.attachBrregOrgnr(place.id, unit.orgnr);
        counts.updated += 1;
      }
    }
  }

  private capped(messages: readonly string[]): string[] {
    if (messages.length <= this.config.maxMessages) {
      return [...messages];
    }
    return [
      ...messages.slice(0, this.config.maxMessages),
      `… and ${String(messages.length - this.config.maxMessages)} more.`,
    ];
  }
}
