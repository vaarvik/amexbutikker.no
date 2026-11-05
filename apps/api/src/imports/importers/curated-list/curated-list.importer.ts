import type {
  Clock,
  Evidence,
  EvidenceTarget,
  IdGenerator,
  ImportContext,
  ImportCounts,
  ImportRunReport,
  NameSimilarity,
  PlaceId,
  PlaceStatusRefresher,
  SourceImporter,
  TransactionalPorts,
} from '@amexbutikker/contracts';
import { parse } from 'yaml';
import { z } from 'zod';
import type { ImportUnitOfWork, TextFileLoader } from '../../imports.ports.js';
import { CuratedClaimFileSchema, CuratedClaimSchema } from './curated-list.model.js';
import type { CuratedClaim } from './curated-list.model.js';

export interface CuratedListImporterConfig {
  /** The claim file, normally data/curated-claims.yaml. */
  readonly path: string;
  readonly maxMessages: number;
}

type Tally = { -readonly [K in keyof ImportCounts]: ImportCounts[K] };

/** How many places a page of search hits may hold; more than one exact match is ambiguous. */
const PLACE_CANDIDATES = 10;

/**
 * Imports hand-curated claims. A chain claim becomes chain_confirmation evidence on the chain,
 * a place claim external_list evidence on the place. Targets are matched by exact normalised
 * name; a missing or ambiguous target is skipped, never created. Affected statuses are
 * recalculated in the same unit of work.
 *
 * The evidence sourceRef is `<sourceUrl>#<target>:<normalised name>@<fetchedAt>`, so the same
 * claim imports once, and a claim re-checked at a later date appends newer evidence.
 */
export class CuratedListImporter implements SourceImporter {
  public readonly source = 'curated_list';

  public constructor(
    private readonly files: TextFileLoader,
    private readonly unitOfWork: ImportUnitOfWork,
    private readonly refresher: PlaceStatusRefresher,
    private readonly names: NameSimilarity,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly config: CuratedListImporterConfig,
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
    let placesRefreshed = 0;
    const report = (status: ImportRunReport['status']): ImportRunReport => ({
      runId: context.runId,
      source: this.source,
      dryRun: context.dryRun,
      status,
      startedAt: context.startedAt,
      finishedAt: this.clock.now(),
      fetchedAt,
      counts: status === 'succeeded' ? counts : { ...counts, unchanged: 0, evidenceAppended: 0 },
      metrics: status === 'succeeded' ? { placesRefreshed } : {},
      messages: this.capped(messages),
    });

    try {
      const raw = await this.claims(messages);
      if (raw === null) {
        return report('failed');
      }
      const claims: (readonly [number, CuratedClaim])[] = [];
      for (const [index, entry] of raw.entries()) {
        counts.read += 1;
        const claim = CuratedClaimSchema.safeParse(entry);
        if (claim.success) {
          claims.push([index, claim.data]);
        } else {
          counts.failed += 1;
          messages.push(
            `claim ${String(index)} is invalid: ${this.oneLine(z.prettifyError(claim.error))}`,
          );
        }
      }
      fetchedAt = claims.reduce<Date | null>(
        (newest, [, claim]) =>
          newest === null || claim.fetchedAt > newest ? claim.fetchedAt : newest,
        null,
      );
      placesRefreshed = await this.unitOfWork.run(context.dryRun, (ports) =>
        this.importClaims(claims, ports, context, counts, messages),
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

  /** The raw claim entries, or null with a message when the file is unusable. */
  private async claims(messages: string[]): Promise<readonly unknown[] | null> {
    const { path } = this.config;
    let text: string;
    try {
      text = await this.files.load(path);
    } catch (error) {
      messages.push(
        `Cannot read ${path}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
    let document: unknown;
    try {
      document = parse(text);
    } catch (error) {
      messages.push(
        `${path} is not valid YAML: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
    const file = CuratedClaimFileSchema.safeParse(document);
    if (!file.success) {
      messages.push(`${path} has no claims list: ${this.oneLine(z.prettifyError(file.error))}`);
      return null;
    }
    return file.data.claims ?? [];
  }

  /** @returns how many place statuses were recalculated. */
  private async importClaims(
    claims: readonly (readonly [number, CuratedClaim])[],
    ports: TransactionalPorts,
    context: ImportContext,
    counts: Tally,
    messages: string[],
  ): Promise<number> {
    const affected = new Set<PlaceId>();
    for (const [index, claim] of claims) {
      context.signal?.throwIfAborted();
      const resolved = await this.resolve(claim, ports);
      if (typeof resolved === 'string') {
        counts.skipped += 1;
        messages.push(`claim ${String(index)}: ${resolved}`);
        continue;
      }
      const outcome = await ports.evidence.append(this.evidence(claim, resolved.target));
      if (outcome === 'duplicate') {
        counts.unchanged += 1;
        continue;
      }
      counts.evidenceAppended += 1;
      for (const placeId of resolved.placeIds) {
        affected.add(placeId);
      }
    }
    for (const placeId of affected) {
      await this.refresher.refresh(ports, placeId);
    }
    return affected.size;
  }

  /** The evidence target and the places whose status it affects, or why there is none. */
  private async resolve(
    claim: CuratedClaim,
    ports: TransactionalPorts,
  ): Promise<{ readonly target: EvidenceTarget; readonly placeIds: readonly PlaceId[] } | string> {
    if (claim.target === 'chain') {
      const chain = await ports.chains.findByName(claim.name);
      if (chain === null) {
        return `no chain named "${claim.name}"`;
      }
      const places = await ports.places.listByChain(chain.id);
      return {
        target: { type: 'chain', chainId: chain.id },
        placeIds: places.map((place) => place.id),
      };
    }
    const wanted = this.names.normalize(claim.name);
    const hits = await ports.places.search({ text: claim.name, limit: PLACE_CANDIDATES });
    const exact = hits.filter((hit) => this.names.normalize(hit.place.name) === wanted);
    const [only] = exact;
    if (only === undefined) {
      return `no place named "${claim.name}"`;
    }
    if (exact.length > 1) {
      return `${String(exact.length)} places are named "${claim.name}"; skipped as ambiguous`;
    }
    return { target: { type: 'place', placeId: only.place.id }, placeIds: [only.place.id] };
  }

  private evidence(claim: CuratedClaim, target: EvidenceTarget): Evidence {
    return {
      id: this.ids.evidenceId(),
      target,
      kind: claim.target === 'chain' ? 'chain_confirmation' : 'external_list',
      result: claim.result,
      source: claim.source,
      sourceRef: `${claim.sourceUrl}#${claim.target}:${this.names.normalize(claim.name)}@${claim.fetchedAt.toISOString()}`,
      observedAt: claim.fetchedAt,
      importedAt: this.clock.now(),
      userId: null,
      note: claim.note,
    };
  }

  private oneLine(text: string): string {
    return text.replaceAll('\n', ' ');
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
