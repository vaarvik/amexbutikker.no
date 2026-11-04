import type {
  ChainId,
  ChainSourceRecord,
  Clock,
  IdGenerator,
  ImportContext,
  ImportCounts,
  ImportRunReport,
  SourceImporter,
  TransactionalPorts,
  UpsertOutcome,
} from '@amexbutikker/contracts';
import {
  OverpassElementSchema,
  OverpassEnvelopeSchema,
  OSM_AMENITY_CATEGORIES,
} from './osm.model.js';
import type { ImportUnitOfWork } from '../../imports.ports.js';
import type { OsmElementTranslator, OverpassClient } from './osm.ports.js';

export interface OverpassOsmImporterConfig {
  /** Overpass area id: an OSM relation id plus 3 600 000 000. */
  readonly areaId: number;
  /** Server-side query timeout. */
  readonly timeoutSeconds: number;
  /** Messages kept in the report; the rest are counted. */
  readonly maxMessages: number;
}

type Tally = { -readonly [K in keyof ImportCounts]: ImportCounts[K] };
type ChainTally = Record<UpsertOutcome, number>;

/**
 * Imports named places in one OSM area from Overpass: the amenities in OSM_AMENITY_CATEGORIES,
 * every shop and tourism=hotel. A brand (brand:wikidata, else brand) becomes a chain.
 * The whole run is one unit of work: it lands completely or not at all.
 */
export class OverpassOsmImporter implements SourceImporter {
  public readonly source = 'osm_overpass';

  public constructor(
    private readonly client: OverpassClient,
    private readonly translator: OsmElementTranslator,
    private readonly unitOfWork: ImportUnitOfWork,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly config: OverpassOsmImporterConfig,
  ) {}

  public async run(context: ImportContext): Promise<ImportRunReport> {
    context.signal?.throwIfAborted();
    const messages: string[] = [];
    let fetchedAt: Date | null = null;
    const counts: Tally = {
      read: 0,
      created: 0,
      updated: 0,
      unchanged: 0,
      skipped: 0,
      failed: 0,
      evidenceAppended: 0,
    };
    const chains: ChainTally = { created: 0, updated: 0, unchanged: 0 };
    const report = (status: ImportRunReport['status']): ImportRunReport => ({
      runId: context.runId,
      source: this.source,
      dryRun: context.dryRun,
      status,
      startedAt: context.startedAt,
      finishedAt: this.clock.now(),
      fetchedAt,
      counts: status === 'succeeded' ? counts : { ...counts, created: 0, updated: 0, unchanged: 0 },
      metrics: {
        chainsCreated: chains.created,
        chainsUpdated: chains.updated,
        chainsUnchanged: chains.unchanged,
      },
      messages: this.capped(messages),
    });

    try {
      const response = await this.client.fetch(this.query(), context.signal);
      fetchedAt = response.fetchedAt;
      const envelope = OverpassEnvelopeSchema.safeParse(response.body);
      if (!envelope.success) {
        messages.push(`The Overpass response is not valid: ${envelope.error.message}`);
        return report('failed');
      }
      if (envelope.data.remark !== undefined) {
        // Overpass reports timeouts and memory exhaustion here, with a truncated result.
        messages.push(`Overpass: ${envelope.data.remark}`);
        return report('failed');
      }
      await this.unitOfWork.run(context.dryRun, (ports) =>
        this.importElements(envelope.data.elements, ports, context, counts, chains, messages),
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

  private async importElements(
    elements: readonly unknown[],
    ports: TransactionalPorts,
    context: ImportContext,
    counts: Tally,
    chains: ChainTally,
    messages: string[],
  ): Promise<void> {
    const chainIds = new Map<string, ChainId>();
    for (const [index, raw] of elements.entries()) {
      context.signal?.throwIfAborted();
      counts.read += 1;
      const element = OverpassElementSchema.safeParse(raw);
      if (!element.success) {
        counts.failed += 1;
        messages.push(`element ${String(index)} is not a valid Overpass element`);
        continue;
      }
      const translation = this.translator.translate(element.data);
      if (translation.kind === 'skipped') {
        counts.skipped += 1;
        messages.push(translation.reason);
        continue;
      }
      messages.push(
        ...translation.warnings.map((warning) => `${translation.place.osmRef}: ${warning}`),
      );
      const chainId =
        translation.chain === null
          ? null
          : await this.chainId(translation.chain, ports, chainIds, chains);
      const { outcome } = await ports.places.upsertFromSource(
        { ...translation.place, chainId },
        this.ids.placeId(),
      );
      counts[outcome] += 1;
    }
  }

  /** Upserts each chain once per run. */
  private async chainId(
    record: ChainSourceRecord,
    ports: TransactionalPorts,
    known: Map<string, ChainId>,
    chains: ChainTally,
  ): Promise<ChainId> {
    const key = record.brandWikidata ?? `name:${record.name.toLowerCase()}`;
    const cached = known.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const { chainId, outcome } = await ports.chains.upsertFromSource(record, this.ids.chainId());
    chains[outcome] += 1;
    known.set(key, chainId);
    return chainId;
  }

  private query(): string {
    const amenities = OSM_AMENITY_CATEGORIES.join('|');
    return [
      `[out:json][timeout:${String(this.config.timeoutSeconds)}];`,
      `area(id:${String(this.config.areaId)})->.a;`,
      '(',
      `  nwr["amenity"~"^(${amenities})$"]["name"](area.a);`,
      '  nwr["shop"]["name"](area.a);',
      '  nwr["tourism"="hotel"]["name"](area.a);',
      ');',
      'out center tags;',
    ].join('\n');
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
