import { describe, expect, it } from 'vitest';
import type { OverpassElement } from '../../../../src/imports/importers/osm-overpass/osm.model.js';
import { DefaultOsmElementTranslator } from '../../../../src/imports/importers/osm-overpass/default-osm-element.translator.js';

const translator = new DefaultOsmElementTranslator();

function node(tags: Record<string, string>, extra: Partial<OverpassElement> = {}): OverpassElement {
  return { type: 'node', id: 42, lat: 59.91, lon: 10.75, tags, ...extra };
}

describe('DefaultOsmElementTranslator', () => {
  it('maps a tagged node to a place with its address and osm ref', () => {
    expect(
      translator.translate(
        node({
          amenity: 'cafe',
          name: ' Kaffebrenneriet Grønland ',
          'addr:street': 'Grønlandsleiret',
          'addr:housenumber': '9',
          'addr:postcode': '0190',
          'addr:city': 'Oslo',
          website: 'https://kaffebrenneriet.no/',
        }),
      ),
    ).toEqual({
      kind: 'place',
      place: {
        osmRef: 'node/42',
        name: 'Kaffebrenneriet Grønland',
        category: 'cafe',
        address: { street: 'Grønlandsleiret 9', postcode: '0190', city: 'Oslo' },
        location: { lat: 59.91, lng: 10.75 },
        website: 'https://kaffebrenneriet.no/',
      },
      chain: null,
      warnings: [],
    });
  });

  it('uses the center of a way', () => {
    const result = translator.translate({
      type: 'way',
      id: 7,
      center: { lat: 59.92, lon: 10.76 },
      tags: { tourism: 'hotel', name: 'Hotell' },
    });

    expect(result).toMatchObject({
      kind: 'place',
      place: { osmRef: 'way/7', category: 'hotel', location: { lat: 59.92, lng: 10.76 } },
    });
  });

  it.each([
    [{ shop: 'supermarket', name: 'Rema 1000' }, 'shop'],
    [{ amenity: 'fast_food', name: 'Kebab' }, 'fast_food'],
    [{ amenity: 'pub', shop: 'alcohol', name: 'Puben' }, 'pub'],
  ])('maps %o to category %s', (tags, category) => {
    expect(translator.translate(node(tags))).toMatchObject({ kind: 'place', place: { category } });
  });

  it('links a brand with its wikidata id to a chain', () => {
    const result = translator.translate(
      node({
        shop: 'supermarket',
        name: 'Rema 1000 Grønland',
        brand: 'Rema 1000',
        'brand:wikidata': 'Q28459',
      }),
    );

    expect(result).toMatchObject({ chain: { name: 'Rema 1000', brandWikidata: 'Q28459' } });
  });

  it('keys a brand without wikidata by name, and takes the place name when only wikidata is set', () => {
    expect(
      translator.translate(node({ shop: 'kiosk', name: 'Narvesen', brand: 'Narvesen' })),
    ).toMatchObject({
      chain: { name: 'Narvesen', brandWikidata: null },
    });
    expect(
      translator.translate(node({ shop: 'kiosk', name: 'Narvesen', 'brand:wikidata': 'Q4' })),
    ).toMatchObject({
      chain: { name: 'Narvesen', brandWikidata: 'Q4' },
    });
  });

  it('drops a malformed wikidata id but keeps the brand', () => {
    const result = translator.translate(
      node({ shop: 'kiosk', name: 'Narvesen', brand: 'Narvesen', 'brand:wikidata': 'narvesen' }),
    );

    expect(result).toMatchObject({
      chain: { name: 'Narvesen', brandWikidata: null },
      warnings: ['brand:wikidata "narvesen" is not a Wikidata id'],
    });
  });

  it('adds a scheme to a bare website and falls back to contact:website', () => {
    expect(
      translator.translate(node({ shop: 'books', name: 'Tanum', website: 'www.tanum.no' })),
    ).toMatchObject({
      place: { website: 'https://www.tanum.no' },
    });
    expect(
      translator.translate(
        node({ shop: 'books', name: 'Tanum', 'contact:website': 'http://tanum.no' }),
      ),
    ).toMatchObject({ place: { website: 'http://tanum.no' } });
  });

  it('keeps the place but drops unusable tags with a warning', () => {
    const result = translator.translate(
      node({ amenity: 'bar', name: 'Baren', 'addr:postcode': 'N-0150', website: 'not a url' }),
    );

    expect(result).toMatchObject({
      kind: 'place',
      place: { address: { street: null, postcode: null, city: null }, website: null },
      warnings: ['addr:postcode "N-0150" is not four digits', 'website "not a url" is not a URL'],
    });
  });

  it('keeps a street without a house number', () => {
    expect(
      translator.translate(node({ amenity: 'bar', name: 'Baren', 'addr:street': 'Torggata' })),
    ).toMatchObject({ place: { address: { street: 'Torggata' } } });
  });

  it.each([
    [node({ shop: 'books' }), 'node/42 has no name'],
    [node({ name: 'Bussholdeplass', highway: 'bus_stop' }), 'node/42 has no imported category'],
    [node({ amenity: 'school', name: 'Skolen' }), 'node/42 has no imported category'],
    [
      node({ shop: 'books', name: 'x'.repeat(201) }),
      'node/42 has a name longer than 200 characters',
    ],
    [
      { type: 'way', id: 42, tags: { shop: 'books', name: 'Tanum' } } as const,
      'way/42 has no location',
    ],
    [node({ shop: 'books', name: 'Tanum' }, { lat: 91 }), 'node/42 has no location'],
    [{ type: 'node', id: 42, lat: 1, lon: 1 } as const, 'node/42 has no name'],
  ])('skips %o', (element, reason) => {
    expect(translator.translate(element)).toEqual({ kind: 'skipped', reason });
  });

  describe('addressPoint', () => {
    it('returns the location and address of an element with street and house number', () => {
      expect(
        translator.addressPoint(
          node({
            'addr:street': 'Disenveien',
            'addr:housenumber': '16F',
            'addr:postcode': '0587',
            'addr:city': 'Oslo',
          }),
        ),
      ).toEqual({
        location: { lat: 59.91, lng: 10.75 },
        address: { street: 'Disenveien 16F', postcode: '0587', city: 'Oslo' },
      });
    });

    it.each([
      node({ 'addr:street': 'Disenveien' }),
      node({ 'addr:housenumber': '16' }),
      {
        type: 'way',
        id: 1,
        tags: { 'addr:street': 'Disenveien', 'addr:housenumber': '16' },
      } as const,
    ])('returns null for %o', (element) => {
      expect(translator.addressPoint(element)).toBeNull();
    });

    it('drops a malformed postcode', () => {
      expect(
        translator.addressPoint(
          node({ 'addr:street': 'Disenveien', 'addr:housenumber': '16', 'addr:postcode': '587' }),
        ),
      ).toMatchObject({ address: { postcode: null } });
    });
  });
});
