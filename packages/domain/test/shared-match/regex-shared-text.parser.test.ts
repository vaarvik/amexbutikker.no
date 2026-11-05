import { SHARED_TEXT_MAX_LENGTH, ValidationError } from '@amexbutikker/contracts';
import { describe, expect, it } from 'vitest';
import { RegexSharedTextParser } from '../../src/index.js';

const parser = new RegexSharedTextParser();

describe('RegexSharedTextParser', () => {
  it.each([[''], ['   \n '], ['x'.repeat(SHARED_TEXT_MAX_LENGTH + 1)]])(
    'rejects empty or too long text',
    (text) => {
      expect(() => parser.parse(text)).toThrow(ValidationError);
    },
  );

  it('reads name and address lines without a link', () => {
    expect(parser.parse('Fuglen\nUniversitetsgata 2, NO-0164 Oslo\n')).toEqual({
      provider: 'unknown',
      name: 'Fuglen',
      street: 'Universitetsgata 2',
      postcode: '0164',
      city: 'Oslo',
      location: null,
      urls: [],
    });
  });

  it('leaves the street empty when the part before the postcode is not a street', () => {
    expect(parser.parse('Fuglen\nGrünerløkka, 0552 Oslo')).toMatchObject({
      name: 'Fuglen',
      street: null,
      postcode: '0552',
    });
  });

  it('reads coordinates written in the text, and ignores impossible ones', () => {
    expect(parser.parse('Bålpanna\n59.9139, 10.7522').location).toEqual({
      lat: 59.9139,
      lng: 10.7522,
    });
    expect(parser.parse('Bålpanna\n99.1, 10.7').location).toBeNull();
  });

  it('takes the address from an Apple link when the text has none', () => {
    expect(
      parser.parse(
        'https://maps.apple.com/?name=Fuglen&coordinate=59.91,10.74&address=Universitetsgata%202,%200164%20Oslo',
      ),
    ).toEqual({
      provider: 'apple_maps',
      name: 'Fuglen',
      street: 'Universitetsgata 2',
      postcode: '0164',
      city: 'Oslo',
      location: { lat: 59.91, lng: 10.74 },
      urls: [
        'https://maps.apple.com/?name=Fuglen&coordinate=59.91,10.74&address=Universitetsgata%202,%200164%20Oslo',
      ],
    });
  });

  it('reads Google search links with a place or with coordinates', () => {
    expect(
      parser.parse(
        'https://www.google.com/maps/search/?api=1&query=Fuglen,+Universitetsgata+2,+0164+Oslo',
      ),
    ).toMatchObject({
      provider: 'google_maps',
      name: 'Fuglen',
      street: 'Universitetsgata 2',
      postcode: '0164',
    });
    expect(parser.parse('https://maps.google.com/maps?q=59.92,10.75')).toMatchObject({
      provider: 'google_maps',
      name: null,
      location: { lat: 59.92, lng: 10.75 },
    });
  });

  it('collects other links and short links without reading them', () => {
    expect(
      parser.parse('Fuglen https://fuglen.no/oslo). Og https://goo.gl/maps/abc'),
    ).toMatchObject({
      provider: 'google_maps',
      name: 'Fuglen Og',
      urls: ['https://fuglen.no/oslo', 'https://goo.gl/maps/abc'],
    });
    expect(parser.parse('https://example.com/maps/place')).toMatchObject({
      provider: 'unknown',
      name: null,
    });
  });

  it('reads links that lack coordinates', () => {
    expect(parser.parse('https://maps.apple.com/?q=Fuglen')).toMatchObject({
      provider: 'apple_maps',
      name: 'Fuglen',
      location: null,
    });
    expect(parser.parse('https://www.google.com/maps/place/Fuglen+Oslo/')).toMatchObject({
      provider: 'google_maps',
      name: 'Fuglen Oslo',
      location: null,
    });
  });

  it('drops a lead-in before a colon', () => {
    expect(parser.parse('Sjekk denne: Fuglen').name).toBe('Fuglen');
  });
});
