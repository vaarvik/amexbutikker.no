import { AddressSchema, GeoPointSchema } from '@amexbutikker/contracts';
import type { ChainSourceRecord, GeoPoint, PlaceCategory } from '@amexbutikker/contracts';
import { z } from 'zod';
import { OSM_AMENITY_CATEGORIES } from './osm.model.js';
import type { OverpassElement } from './osm.model.js';
import type { OsmElementTranslator, OsmTranslation } from './osm.ports.js';

const MAX_NAME_LENGTH = 200;
const WebsiteSchema = z.url({ protocol: /^https?$/ });
const PostcodeSchema = z.string().regex(/^\d{4}$/);
const WikidataIdSchema = z.string().regex(/^Q\d+$/);

/**
 * Translates OSM tags into the place model. `amenity` wins over `shop`, which wins over
 * `tourism=hotel`. A tag that cannot be used is dropped with a warning; the place is kept.
 */
export class DefaultOsmElementTranslator implements OsmElementTranslator {
  public translate(element: OverpassElement): OsmTranslation {
    const osmRef = `${element.type}/${String(element.id)}`;
    const tags = element.tags ?? {};
    const name = tags.name?.trim() ?? '';
    if (name === '') {
      return { kind: 'skipped', reason: `${osmRef} has no name` };
    }
    if (name.length > MAX_NAME_LENGTH) {
      return {
        kind: 'skipped',
        reason: `${osmRef} has a name longer than ${String(MAX_NAME_LENGTH)} characters`,
      };
    }
    const category = this.category(tags);
    if (category === null) {
      return { kind: 'skipped', reason: `${osmRef} has no imported category` };
    }
    const location = this.location(element);
    if (location === null) {
      return { kind: 'skipped', reason: `${osmRef} has no location` };
    }

    const warnings: string[] = [];
    const postcode = this.valid(
      tags['addr:postcode'],
      PostcodeSchema,
      'addr:postcode',
      'is not four digits',
      warnings,
    );
    const address = AddressSchema.parse({
      street: this.street(tags),
      postcode,
      city: this.nonEmpty(tags['addr:city']),
    });
    const website = this.valid(
      this.withScheme(tags.website ?? tags['contact:website']),
      WebsiteSchema,
      'website',
      'is not a URL',
      warnings,
    );
    return {
      kind: 'place',
      place: { osmRef, name, category, address, location, website },
      chain: this.chain(tags, name, warnings),
      warnings,
    };
  }

  private category(tags: Readonly<Record<string, string>>): PlaceCategory | null {
    const amenity = OSM_AMENITY_CATEGORIES.find((value) => value === tags.amenity);
    if (amenity !== undefined) {
      return amenity;
    }
    if (tags.shop !== undefined) {
      return 'shop';
    }
    return tags.tourism === 'hotel' ? 'hotel' : null;
  }

  private location(element: OverpassElement): GeoPoint | null {
    const lat = element.lat ?? element.center?.lat;
    const lng = element.lon ?? element.center?.lon;
    const parsed = GeoPointSchema.safeParse({ lat, lng });
    return parsed.success ? parsed.data : null;
  }

  private street(tags: Readonly<Record<string, string>>): string | null {
    const street = tags['addr:street']?.trim();
    if (street === undefined || street === '') {
      return null;
    }
    const number = tags['addr:housenumber']?.trim();
    return number === undefined || number === '' ? street : `${street} ${number}`;
  }

  private chain(
    tags: Readonly<Record<string, string>>,
    name: string,
    warnings: string[],
  ): ChainSourceRecord | null {
    const brand = tags.brand?.trim();
    const brandWikidata = this.valid(
      tags['brand:wikidata'],
      WikidataIdSchema,
      'brand:wikidata',
      'is not a Wikidata id',
      warnings,
    );
    if (brand !== undefined && brand !== '') {
      return { name: brand, brandWikidata };
    }
    return brandWikidata === null ? null : { name, brandWikidata };
  }

  private nonEmpty(value: string | undefined): string | null {
    const trimmed = value?.trim() ?? '';
    return trimmed === '' ? null : trimmed;
  }

  private withScheme(url: string | undefined): string | undefined {
    const trimmed = url?.trim();
    return trimmed === undefined || /^[a-z]+:\/\//i.test(trimmed) || !trimmed.includes('.')
      ? trimmed
      : `https://${trimmed}`;
  }

  /** The value when the schema accepts it; otherwise null, with a warning if a value was given. */
  private valid(
    value: string | undefined,
    schema: z.ZodType<string>,
    tag: string,
    problem: string,
    warnings: string[],
  ): string | null {
    const trimmed = value?.trim();
    if (trimmed === undefined || trimmed === '') {
      return null;
    }
    if (schema.safeParse(trimmed).success) {
      return trimmed;
    }
    warnings.push(`${tag} "${trimmed}" ${problem}`);
    return null;
  }
}
