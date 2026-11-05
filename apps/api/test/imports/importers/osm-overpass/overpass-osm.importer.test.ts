import type {
  Clock,
  ImportContext,
  ImportRunId,
  TransactionalPorts,
} from '@amexbutikker/contracts';
import { CalculatingPlaceStatusRefresher } from '@amexbutikker/application';
import {
  DecayingAcceptanceStatusCalculator,
  FixedEvidenceWeightPolicy,
  ProportionChainHintCalculator,
  SupersedingEvidenceSelector,
  TrigramNameSimilarity,
} from '@amexbutikker/domain';
import {
  EmptyInMemoryTablesFactory,
  InMemoryChainRepository,
  InMemoryEvidenceRepository,
  InMemoryPlaceRepository,
  InMemoryPlaceStatusRepository,
  InMemoryUnitOfWork,
} from '@amexbutikker/in-memory';
import type { InMemoryTables } from '@amexbutikker/in-memory';
import { beforeEach, describe, expect, it } from 'vitest';
import { TagOsmElementTranslator } from '../../../../src/imports/importers/osm-overpass/tag-osm-element.translator.js';
import type {
  OverpassClient,
  OverpassResponse,
} from '../../../../src/imports/importers/osm-overpass/osm-overpass.ports.js';
import { TransactionalImportUnitOfWork } from '../../../../src/imports/transactional-import.unit-of-work.js';
import { GridOsmAddressLocator } from '../../../../src/imports/importers/osm-overpass/grid-osm-address.locator.js';
import { OverpassOsmImporter } from '../../../../src/imports/importers/osm-overpass/overpass-osm.importer.js';
import { UuidV7IdGenerator } from '../../../../src/shared/uuid-v7-id.generator.js';

const fetchedAt = new Date('2026-11-04T06:00:00Z');
const clock: Clock = { now: () => new Date('2026-11-04T08:00:00Z') };
const names = new TrigramNameSimilarity();

class StubOverpassClient implements OverpassClient {
  public queries: string[] = [];

  public constructor(
    public body: unknown,
    public addressBody: unknown = { elements: [] },
  ) {}

  public fetch(query: string): Promise<OverpassResponse> {
    this.queries.push(query);
    const body = query.includes('addr:housenumber') ? this.addressBody : this.body;
    return Promise.resolve({ body, fetchedAt });
  }
}

class FailingOverpassClient implements OverpassClient {
  public fetch(): Promise<OverpassResponse> {
    return Promise.reject(
      new Error('Overpass answered 504 Gateway Timeout (busy, try again later).'),
    );
  }
}

const elements = [
  {
    type: 'node',
    id: 1,
    lat: 59.91,
    lon: 10.75,
    tags: {
      shop: 'supermarket',
      name: 'Rema 1000 Grønland',
      brand: 'Rema 1000',
      'brand:wikidata': 'Q28459',
    },
  },
  {
    type: 'way',
    id: 2,
    center: { lat: 59.92, lon: 10.76 },
    tags: {
      shop: 'supermarket',
      name: 'Rema 1000 Tøyen',
      brand: 'Rema 1000',
      'brand:wikidata': 'Q28459',
    },
  },
  {
    type: 'node',
    id: 3,
    lat: 59.93,
    lon: 10.77,
    tags: { amenity: 'cafe', name: 'Kafé Åsen', 'addr:postcode': 'x' },
  },
  { type: 'node', id: 4, lat: 59.93, lon: 10.77, tags: { amenity: 'cafe' } },
  { type: 'node', id: -5 },
];

function portsFor(tables: InMemoryTables): TransactionalPorts {
  return {
    places: new InMemoryPlaceRepository(tables, names, clock),
    chains: new InMemoryChainRepository(tables, names, clock),
    evidence: new InMemoryEvidenceRepository(tables),
    statuses: new InMemoryPlaceStatusRepository(tables),
  };
}

function refresher(): CalculatingPlaceStatusRefresher {
  return new CalculatingPlaceStatusRefresher(
    new DecayingAcceptanceStatusCalculator(
      new FixedEvidenceWeightPolicy(),
      {},
      new SupersedingEvidenceSelector(),
    ),
    new ProportionChainHintCalculator(),
    clock,
  );
}

function context(dryRun = false): ImportContext {
  return {
    runId: '0190a000-0000-7000-8000-000000000001' as ImportRunId,
    startedAt: clock.now(),
    dryRun,
  };
}

describe('OverpassOsmImporter', () => {
  let tables: InMemoryTables;
  let client: StubOverpassClient;
  let importer: OverpassOsmImporter;

  beforeEach(() => {
    tables = new EmptyInMemoryTablesFactory().create();
    client = new StubOverpassClient({ elements });
    importer = new OverpassOsmImporter(
      client,
      new TagOsmElementTranslator(),
      new GridOsmAddressLocator(0.0005),
      new TransactionalImportUnitOfWork(new InMemoryUnitOfWork(tables, portsFor)),
      refresher(),
      new UuidV7IdGenerator(clock),
      clock,
      { areaId: 3_600_406_091, timeoutSeconds: 180, maxMessages: 10, addressMaxDistanceM: 25 },
    );
  });

  it('queries the configured area for the imported categories', async () => {
    await importer.run(context());

    expect(client.queries).toHaveLength(2);
    expect(client.queries[0]).toContain('area(id:3600406091)');
    expect(client.queries[0]).toContain('[timeout:180]');
    expect(client.queries[0]).toContain('nwr["shop"]["name"](area.a);');
    expect(client.queries[0]).toContain('out center tags;');
    expect(client.queries[1]).toContain('nwr["addr:street"]["addr:housenumber"](area.a);');
  });

  it('creates places and one chain per brand, and reports what it did', async () => {
    const report = await importer.run(context());

    expect(report).toMatchObject({
      runId: context().runId,
      source: 'osm_overpass',
      dryRun: false,
      status: 'succeeded',
      fetchedAt,
      counts: {
        read: 5,
        created: 3,
        updated: 0,
        unchanged: 0,
        skipped: 1,
        failed: 1,
        evidenceAppended: 0,
      },
      metrics: { chainsCreated: 1, chainsUpdated: 0, chainsUnchanged: 0 },
    });
    expect(report.messages).toEqual([
      'node/3: addr:postcode "x" is not four digits',
      'node/4 has no name',
      'element 4 is not a valid Overpass element',
    ]);
    const places = [...tables.places.values()];
    expect(places.map((place) => place.kind === 'physical' && place.osmRef).sort()).toEqual([
      'node/1',
      'node/3',
      'way/2',
    ]);
    const [chain] = [...tables.chains.values()];
    expect(tables.chains.size).toBe(1);
    expect(
      places.filter((place) => place.kind === 'physical' && place.chainId === chain?.id),
    ).toHaveLength(2);
  });

  it('gives a place without an address the nearest address point, and keeps its own address otherwise', async () => {
    client.addressBody = {
      elements: [
        {
          type: 'node',
          id: 100,
          lat: 59.93005,
          lon: 10.77,
          tags: { 'addr:street': 'Torggata', 'addr:housenumber': '5', 'addr:postcode': '0181' },
        },
        {
          type: 'way',
          id: 101,
          center: { lat: 59.9101, lon: 10.75 },
          tags: { 'addr:street': 'Grønlandsleiret', 'addr:housenumber': '9' },
        },
        { type: 'node', id: 102 },
      ],
    };

    const report = await importer.run(context());

    expect(report.metrics).toMatchObject({ addressPoints: 2, addressesFromNearbyPoint: 2 });
    const byRef = new Map(
      [...tables.places.values()].flatMap((place) =>
        place.kind === 'physical' ? [[place.osmRef, place]] : [],
      ),
    );
    expect(byRef.get('node/3')?.address).toEqual({
      street: 'Torggata 5',
      postcode: '0181',
      city: null,
    });
    expect(byRef.get('node/1')?.address).toEqual({
      street: 'Grønlandsleiret 9',
      postcode: null,
      city: null,
    });
    expect(byRef.get('way/2')?.address.street).toBeNull();
  });

  it('turns payment tags into likely answers, once per tag value', async () => {
    const tagged = (id: number, payment: Record<string, string>) => ({
      type: 'node',
      id,
      lat: 59.93,
      lon: 10.77,
      tags: { amenity: 'cafe', name: `Kafé ${String(id)}`, ...payment },
    });
    client.body = {
      elements: [
        tagged(10, { 'payment:american_express': 'yes' }),
        tagged(11, { 'payment:credit_cards': 'no' }),
        tagged(12, {}),
      ],
    };

    const first = await importer.run(context());
    const again = await importer.run(context());

    expect(first.counts.evidenceAppended).toBe(2);
    expect(first.metrics).toMatchObject({ placesRefreshed: 2 });
    expect(again.counts.evidenceAppended).toBe(0);
    const evidence = [...tables.evidence.values()];
    expect(evidence.map((item) => [item.source, item.kind, item.result, item.sourceRef])).toEqual([
      [
        'osm',
        'external_list',
        'accepted',
        'https://www.openstreetmap.org/node/10#payment:american_express=yes',
      ],
      [
        'osm',
        'external_list',
        'rejected',
        'https://www.openstreetmap.org/node/11#payment:credit_cards=no',
      ],
    ]);
    const statuses = [...tables.statuses.values()].map((snapshot) => snapshot.status.status);
    expect(statuses.sort()).toEqual(['likely_accepted', 'likely_rejected']);
  });

  it('appends newer evidence when a payment tag changes', async () => {
    const cafe = (value: string) => ({
      elements: [
        {
          type: 'node',
          id: 20,
          lat: 59.93,
          lon: 10.77,
          tags: { amenity: 'cafe', name: 'Kafé Bytt', 'payment:american_express': value },
        },
      ],
    });
    client.body = cafe('yes');
    await importer.run(context());
    client.body = cafe('no');

    const changed = await importer.run(context());

    expect(changed.counts.evidenceAppended).toBe(1);
    expect([...tables.statuses.values()][0]?.status.status).toBe('likely_rejected');
  });

  it('fails when the address query fails', async () => {
    client.addressBody = { remark: 'runtime error: out of memory' };

    await expect(importer.run(context())).resolves.toMatchObject({
      status: 'failed',
      messages: [expect.stringMatching(/^The Overpass response is not valid/)],
    });
  });

  it('is idempotent: a second run over the same data changes nothing', async () => {
    await importer.run(context());
    const before = new Map(tables.places);

    const report = await importer.run(context());

    expect(report.counts).toMatchObject({ created: 0, updated: 0, unchanged: 3 });
    expect(report.metrics).toMatchObject({ chainsCreated: 0, chainsUnchanged: 1 });
    expect(tables.places).toEqual(before);
  });

  it('updates a place whose tags changed', async () => {
    await importer.run(context());
    client.body = {
      elements: [
        {
          type: 'node',
          id: 3,
          lat: 59.93,
          lon: 10.77,
          tags: { amenity: 'bar', name: 'Baren Åsen' },
        },
      ],
    };

    const report = await importer.run(context());

    expect(report.counts).toMatchObject({ read: 1, created: 0, updated: 1 });
    expect([...tables.places.values()].find((place) => place.name === 'Baren Åsen')?.category).toBe(
      'bar',
    );
  });

  it('writes nothing in a dry run but reports the same counts', async () => {
    const report = await importer.run(context(true));

    expect(report).toMatchObject({ dryRun: true, status: 'succeeded', counts: { created: 3 } });
    expect(tables.places.size).toBe(0);
    expect(tables.chains.size).toBe(0);
  });

  it('caps the messages and says how many were left out', async () => {
    client.body = { elements: Array.from({ length: 12 }, (_, i) => ({ type: 'node', id: i + 1 })) };

    const report = await importer.run(context());

    expect(report.messages).toHaveLength(11);
    expect(report.messages.at(-1)).toBe('… and 2 more.');
  });

  it('reports a failed fetch instead of throwing', async () => {
    const failing = new OverpassOsmImporter(
      new FailingOverpassClient(),
      new TagOsmElementTranslator(),
      new GridOsmAddressLocator(0.0005),
      new TransactionalImportUnitOfWork(new InMemoryUnitOfWork(tables, portsFor)),
      refresher(),
      new UuidV7IdGenerator(clock),
      clock,
      { areaId: 1, timeoutSeconds: 1, maxMessages: 10, addressMaxDistanceM: 25 },
    );

    await expect(failing.run(context())).resolves.toMatchObject({
      status: 'failed',
      fetchedAt: null,
      counts: { read: 0 },
      messages: ['Overpass answered 504 Gateway Timeout (busy, try again later).'],
    });
  });

  it('reports a response that is not an Overpass result', async () => {
    client.body = { remark: 'runtime error: Query timed out' };

    await expect(importer.run(context())).resolves.toMatchObject({
      status: 'failed',
      fetchedAt: null,
      messages: [expect.stringMatching(/^The Overpass response is not valid/)],
    });
  });

  it('reports a runtime remark from Overpass as a failure, since the result may be incomplete', async () => {
    client.body = { elements, remark: 'runtime error: Query timed out in "query" at line 4' };

    const report = await importer.run(context());

    expect(report).toMatchObject({ status: 'failed', counts: { created: 0 } });
    expect(report.messages).toEqual([
      'Overpass: runtime error: Query timed out in "query" at line 4',
    ]);
    expect(tables.places.size).toBe(0);
  });

  it('rethrows an abort and rolls back', async () => {
    const controller = new AbortController();
    controller.abort(new Error('stopped'));

    await expect(importer.run({ ...context(), signal: controller.signal })).rejects.toThrow(
      'stopped',
    );
    expect(tables.places.size).toBe(0);
  });
});
