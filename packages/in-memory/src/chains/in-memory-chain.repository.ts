import { ConflictError, NotFoundError } from '@amexbutikker/contracts';
import type {
  Chain,
  ChainHint,
  ChainId,
  ChainReader,
  ChainSourceRecord,
  ChainUpsertResult,
  ChainWriter,
  Clock,
  NameSimilarity,
} from '@amexbutikker/contracts';
import type { InMemoryTables } from '../shared/in-memory.ports.js';

export class InMemoryChainRepository implements ChainReader, ChainWriter {
  public constructor(
    private readonly tables: InMemoryTables,
    private readonly names: NameSimilarity,
    private readonly clock: Clock,
  ) {}

  public getById(id: ChainId): Promise<Chain> {
    const chain = this.tables.chains.get(id);
    return chain === undefined
      ? Promise.reject(new NotFoundError('Chain', id))
      : Promise.resolve(chain);
  }

  public findByName(name: string): Promise<Chain | null> {
    const wanted = this.names.normalize(name);
    const matches = [...this.tables.chains.values()]
      .filter((chain) => this.names.normalize(chain.name) === wanted)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return Promise.resolve(matches[0] ?? null);
  }

  public findHint(chainId: ChainId): Promise<ChainHint | null> {
    return Promise.resolve(this.tables.chainHints.get(chainId) ?? null);
  }

  public create(chain: Chain): Promise<void> {
    if (this.tables.chains.has(chain.id)) {
      return Promise.reject(new ConflictError(`Chain ${chain.id} already exists.`));
    }
    if (chain.brandWikidata !== null && this.findByWikidata(chain.brandWikidata) !== undefined) {
      return Promise.reject(
        new ConflictError(`brandWikidata ${chain.brandWikidata} is already taken.`),
      );
    }
    this.tables.chains.set(chain.id, chain);
    return Promise.resolve();
  }

  public async upsertFromSource(
    record: ChainSourceRecord,
    newId: ChainId,
  ): Promise<ChainUpsertResult> {
    const existing =
      record.brandWikidata !== null
        ? this.findByWikidata(record.brandWikidata)
        : ((await this.findByName(record.name)) ?? undefined);
    if (existing === undefined) {
      this.tables.chains.set(newId, { id: newId, createdAt: this.clock.now(), ...record });
      return { chainId: newId, outcome: 'created' };
    }
    // Keyed by name there is nothing to update: the match already ignores case and accents.
    if (record.brandWikidata === null || existing.name === record.name) {
      return { chainId: existing.id, outcome: 'unchanged' };
    }
    this.tables.chains.set(existing.id, { ...existing, name: record.name });
    return { chainId: existing.id, outcome: 'updated' };
  }

  public saveHint(hint: ChainHint): Promise<void> {
    if (!this.tables.chains.has(hint.chainId)) {
      return Promise.reject(new NotFoundError('Chain', hint.chainId));
    }
    this.tables.chainHints.set(hint.chainId, hint);
    return Promise.resolve();
  }

  private findByWikidata(brandWikidata: string): Chain | undefined {
    return [...this.tables.chains.values()].find((chain) => chain.brandWikidata === brandWikidata);
  }
}
