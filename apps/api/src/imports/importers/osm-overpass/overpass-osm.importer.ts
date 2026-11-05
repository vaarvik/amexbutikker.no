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
import type { OsmAddressIndex, OsmAddressPoint } from './osm.model.js';
import {
  OverpassElementSchema,
  OverpassEnvelopeSchema,
  OSM_AMENITY_CATEGORIES,
} from './osm.model.js';
import type { ImportUnitOfWork } from '../../imports.ports.js';
import type { OsmAddressLocator, OsmElementTranslator, OverpassClient } from './osm.ports.js';

export interface OverpassOsmImporterConfig {
  /** Overpass area id: an OSM relation id plus 3 600 000 000. */
  readonly areaId: number;
  /** Server-side query timeout. */
  readonly timeoutSeconds: number;
  /** Messages kept in the report; the rest are counted. */
  readonly maxMessages: number;
  /** A place without its own address takes the nearest address point within this distance. */
  readonly addressMaxDistanceM: number;
}

type Tally = { -readonly [K in keyof ImportCounts]: ImportCounts[K] };
type ChainTally = Record<UpsertOutcome, number>;

/**
 * Imports named places in one OSM area from Overpass: the amenities in OSM_AMENITY_CATEGORIES,
 * every shop and tourism=hotel. A brand (brand:wikidata, else brand) becomes a chain.
 * Most places in Norway carry no address of their own (addresses are separate points from the
 * Kartverket import), so a second query loads the address points, and a place without an
 * address takes the nearest one within `addressMaxDistanceM`.
 * The whole run is one unit of work: it lands completely or not at all.
 */
export class OverpassOsmImporter implements SourceImporter {
  public readonly source = 'osm_overpass';

  public constructor(
    private readonly client: OverpassClient,
    private readonly translator: OsmElementTranslator,
    private readonly addresses: OsmAddressLocator,
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
    const enriched = { addressPoints: 0, addressesFromNearbyPoint: 0 };
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
        ...enriched,
      },
      messages: this.capped(messages),
    });

    try {
      const places = await this.fetch(this.placeQuery(), context, messages);
      if (places === null) {
        return report('failed');
      }
      fetchedAt = places.fetchedAt;
      const addressElements = await this.fetch(this.addressQuery(), context, messages);
      if (addressElements === null) {
        return report('failed');
      }
      const points = this.addressPoints(addressElements.elements);
      enriched.addressPoints = points.length;
      const index = this.addresses.index(points);
      await this.unitOfWork.run(context.dryRun, async (ports) => {
        enriched.addressesFromNearbyPoint = await this.importElements(
          places.elements,
          index,
          ports,
          context,
          counts,
          chains,
          messages,
        );
      });
      return report('succeeded');
    } catch (error) {
      if (context.signal?.aborted === true) {
        throw context.signal.reason;
      }
      messages.push(error instanceof Error ? error.message : 'The import threw a non-error value.');
      return report('failed');
    }
  }

  /** The elements of one query, or null with a message when the response is unusable. */
  private async fetch(
    query: string,
    context: ImportContext,
    messages: string[],
  ): Promise<{ readonly elements: readonly unknown[]; readonly fetchedAt: Date } | null> {
    const response = await this.client.fetch(query, context.signal);
    const envelope = OverpassEnvelopeSchema.safeParse(response.body);
    if (!envelope.success) {
      messages.push(`The Overpass response is not valid: ${envelope.error.message}`);
      return null;
    }
    if (envelope.data.remark !== undefined) {
      // Overpass reports timeouts and memory exhaustion here, with a truncated result.
      messages.push(`Overpass: ${envelope.data.remark}`);
      return null;
    }
    return { elements: envelope.data.elements, fetchedAt: response.fetchedAt };
  }

  private addressPoints(elements: readonly unknown[]): OsmAddressPoint[] {
    const points: OsmAddressPoint[] = [];
    for (const raw of elements) {
      const element = OverpassElementSchema.safeParse(raw);
      const point = element.success ? this.translator.addressPoint(element.data) : null;
      if (point !== null) {
        points.push(point);
      }
    }
    return points;
  }

  /** @returns how many places took their address from a nearby point. */
  private async importElements(
    elements: readonly unknown[],
    addressIndex: OsmAddressIndex,
    ports: TransactionalPorts,
    context: ImportContext,
    counts: Tally,
    chains: ChainTally,
    messages: string[],
  ): Promise<number> {
    let fromNearbyPoint = 0;
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
      let { address } = translation.place;
      if (address.street === null) {
        const nearby = this.addresses.nearest(
          addressIndex,
          translation.place.location,
          this.config.addressMaxDistanceM,
        );
        if (nearby !== null) {
          address = nearby;
          fromNearbyPoint += 1;
        }
      }
      const { outcome } = await ports.places.upsertFromSource(
        { ...translation.place, address, chainId },
        this.ids.placeId(),
      );
      counts[outcome] += 1;
    }
    return fromNearbyPoint;
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

  private placeQuery(): string {
    const amenities = OSM_AMENITY_CATEGORIES.join('|');
    return [
      ...this.header(),
      '(',
      `  nwr["amenity"~"^(${amenities})$"]["name"](area.a);`,
      '  nwr["shop"]["name"](area.a);',
      '  nwr["tourism"="hotel"]["name"](area.a);',
      ');',
      'out center tags;',
    ].join('\n');
  }

  private addressQuery(): string {
    return [
      ...this.header(),
      'nwr["addr:street"]["addr:housenumber"](area.a);',
      'out center tags;',
    ].join('\n');
  }

  private header(): string[] {
    return [
      `[out:json][timeout:${String(this.config.timeoutSeconds)}];`,
      `area(id:${String(this.config.areaId)})->.a;`,
    ];
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
