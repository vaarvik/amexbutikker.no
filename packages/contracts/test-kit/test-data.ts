import type {
  Chain,
  ChainHint,
  ChainId,
  Evidence,
  EvidenceId,
  GeoPoint,
  HouseholdId,
  ImportRunId,
  OnlinePlace,
  PhysicalPlace,
  PlaceId,
  PlaceStatusSnapshot,
  UserId,
} from '../src/index.js';

/** Oslo Sentralstasjon. */
export const OSLO_S: GeoPoint = { lat: 59.9111, lng: 10.7528 };

/** Shifts a point roughly `northM` metres north and `eastM` metres east (fine at city scale). */
export function offset(point: GeoPoint, northM: number, eastM = 0): GeoPoint {
  const metresPerDegreeLat = 111_320;
  const metresPerDegreeLng = metresPerDegreeLat * Math.cos((point.lat * Math.PI) / 180);
  return {
    lat: point.lat + northM / metresPerDegreeLat,
    lng: point.lng + eastM / metresPerDegreeLng,
  };
}

export const T0 = new Date('2026-01-01T12:00:00.000Z');

export function daysAfter(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 86_400_000);
}

/**
 * Test data builders. Every id is a fresh, valid UUID with a random prefix, so builders can be
 * called repeatedly, and suites can share a database, without collisions. Use one instance per test.
 */
export class TestData {
  private counter = 0;

  public placeId(): PlaceId {
    return this.uuid() as PlaceId;
  }

  public chainId(): ChainId {
    return this.uuid() as ChainId;
  }

  public userId(): UserId {
    return this.uuid() as UserId;
  }

  public evidenceId(): EvidenceId {
    return this.uuid() as EvidenceId;
  }

  public householdId(): HouseholdId {
    return this.uuid() as HouseholdId;
  }

  public importRunId(): ImportRunId {
    return this.uuid() as ImportRunId;
  }

  public physicalPlace(overrides: Partial<PhysicalPlace> = {}): PhysicalPlace {
    const n = this.next();
    return {
      kind: 'physical',
      id: this.placeId(),
      name: `Testkafé ${String(n)}`,
      category: 'cafe',
      website: null,
      createdAt: T0,
      chainId: null,
      address: { street: `Karl Johans gate ${String(n)}`, postcode: '0154', city: 'Oslo' },
      location: OSLO_S,
      osmRef: `node/${String(1_000_000 + n)}`,
      brregOrgnr: null,
      ...overrides,
    };
  }

  public onlinePlace(overrides: Partial<OnlinePlace> = {}): OnlinePlace {
    const n = this.next();
    return {
      kind: 'online',
      id: this.placeId(),
      name: `Nettbutikk ${String(n)}`,
      category: 'online_shop',
      website: `https://shop${String(n)}.example.no/`,
      createdAt: T0,
      ...overrides,
    };
  }

  public chain(overrides: Partial<Chain> = {}): Chain {
    const n = this.next();
    return {
      id: this.chainId(),
      name: `Testkjede ${String(n)}`,
      brandWikidata: `Q${String(900_000 + n)}`,
      createdAt: T0,
      ...overrides,
    };
  }

  /** A user report on a place, unless overridden. */
  public evidence(overrides: Partial<Evidence> & Pick<Evidence, 'target'>): Evidence {
    const id = this.evidenceId();
    return {
      id,
      kind: 'user_report',
      result: 'accepted',
      source: 'app',
      sourceRef: id,
      observedAt: T0,
      importedAt: T0,
      userId: this.userId(),
      note: null,
      ...overrides,
    };
  }

  public statusSnapshot(
    placeId: PlaceId,
    overrides: Partial<PlaceStatusSnapshot> = {},
  ): PlaceStatusSnapshot {
    return {
      placeId,
      status: {
        status: 'accepted',
        confidence: 0.9,
        basis: 'user_report',
        verified: false,
        lastEvidenceAt: T0,
      },
      calculatedAt: T0,
      ...overrides,
    };
  }

  public chainHint(chainId: ChainId, overrides: Partial<ChainHint> = {}): ChainHint {
    return { chainId, acceptedCount: 7, totalWithEvidence: 9, calculatedAt: T0, ...overrides };
  }

  private next(): number {
    this.counter += 1;
    return this.counter;
  }

  private uuid(): string {
    const n = this.next().toString(16).padStart(12, '0');
    const run = Math.floor(Math.random() * 0xffff_ffff)
      .toString(16)
      .padStart(8, '0');
    return `${run}-0000-4000-8000-${n}`;
  }
}
