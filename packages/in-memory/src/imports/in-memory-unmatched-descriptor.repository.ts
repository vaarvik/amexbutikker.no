import type {
  UnmatchedDescriptor,
  UnmatchedDescriptorReader,
  UnmatchedDescriptorWriter,
  UpsertOutcome,
} from '@amexbutikker/contracts';
import type { InMemoryTables } from '../shared/shared.ports.js';

const DAY_MS = 86_400_000;

export class InMemoryUnmatchedDescriptorRepository
  implements UnmatchedDescriptorWriter, UnmatchedDescriptorReader
{
  public constructor(private readonly tables: InMemoryTables) {}

  public upsert(descriptor: string, seenOn: Date): Promise<UpsertOutcome> {
    const key = descriptor.trim().replace(/\s+/g, ' ').toUpperCase();
    const day = new Date(Math.floor(seenOn.getTime() / DAY_MS) * DAY_MS);
    const existing = this.tables.unmatchedDescriptors.get(key);
    if (existing === undefined) {
      this.tables.unmatchedDescriptors.set(key, {
        descriptor: key,
        firstSeenOn: day,
        lastSeenOn: day,
      });
      return Promise.resolve('created');
    }
    const firstSeenOn = day < existing.firstSeenOn ? day : existing.firstSeenOn;
    const lastSeenOn = day > existing.lastSeenOn ? day : existing.lastSeenOn;
    if (firstSeenOn === existing.firstSeenOn && lastSeenOn === existing.lastSeenOn) {
      return Promise.resolve('unchanged');
    }
    this.tables.unmatchedDescriptors.set(key, { descriptor: key, firstSeenOn, lastSeenOn });
    return Promise.resolve('updated');
  }

  public list(): Promise<UnmatchedDescriptor[]> {
    return Promise.resolve(
      [...this.tables.unmatchedDescriptors.values()].sort(
        (a, b) =>
          b.lastSeenOn.getTime() - a.lastSeenOn.getTime() ||
          a.descriptor.localeCompare(b.descriptor),
      ),
    );
  }

  /** Byte order, like Postgres' C collation. */
  private codePointOrder(a: string, b: string): number {
    if (a === b) {
      return 0;
    }
    return a < b ? -1 : 1;
  }
}
