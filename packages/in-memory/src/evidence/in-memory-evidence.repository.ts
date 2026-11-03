import { NotFoundError } from '@amexbutikker/contracts';
import type {
  AppendOutcome,
  ChainId,
  Evidence,
  EvidenceReader,
  EvidenceWriter,
  PlaceId,
} from '@amexbutikker/contracts';
import type { InMemoryTables } from '../shared/in-memory.ports.js';

/** Append-only: there is deliberately no code path that changes or removes evidence. */
export class InMemoryEvidenceRepository implements EvidenceReader, EvidenceWriter {
  public constructor(private readonly tables: InMemoryTables) {}

  public listForPlace(placeId: PlaceId): Promise<Evidence[]> {
    return Promise.resolve(
      this.sorted(
        (evidence) => evidence.target.type === 'place' && evidence.target.placeId === placeId,
      ),
    );
  }

  public listForChain(chainId: ChainId): Promise<Evidence[]> {
    return Promise.resolve(
      this.sorted(
        (evidence) => evidence.target.type === 'chain' && evidence.target.chainId === chainId,
      ),
    );
  }

  public append(evidence: Evidence): Promise<AppendOutcome> {
    const { target } = evidence;
    if (target.type === 'place' && !this.tables.places.has(target.placeId)) {
      return Promise.reject(new NotFoundError('Place', target.placeId));
    }
    if (target.type === 'chain' && !this.tables.chains.has(target.chainId)) {
      return Promise.reject(new NotFoundError('Chain', target.chainId));
    }
    for (const existing of this.tables.evidence.values()) {
      if (existing.source === evidence.source && existing.sourceRef === evidence.sourceRef) {
        return Promise.resolve('duplicate');
      }
    }
    this.tables.evidence.set(evidence.id, evidence);
    return Promise.resolve('appended');
  }

  private sorted(predicate: (evidence: Evidence) => boolean): Evidence[] {
    return [...this.tables.evidence.values()]
      .filter(predicate)
      .sort(
        (a, b) =>
          b.observedAt.getTime() - a.observedAt.getTime() ||
          b.importedAt.getTime() - a.importedAt.getTime() ||
          (a.id < b.id ? 1 : a.id > b.id ? -1 : 0),
      );
  }
}
