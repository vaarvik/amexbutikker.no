import type {
  AppendHouseholdRecordsResponseDto,
  HouseholdId,
  HouseholdRecordListResponseDto,
  HouseholdResponseDto,
} from '@amexbutikker/contracts';
import { ApiError } from '../../src/shared/fetch-json.transport';
import type { RandomBytesProvider } from '../../src/shared/shared.ports';
import type { HouseholdsApiClient } from '../../src/households/households.ports';

export const HOUSEHOLD_ID = '0190a000-0000-7000-8000-0000000000aa' as HouseholdId;

export class NodeRandomBytes implements RandomBytesProvider {
  public bytes(count: number): Uint8Array {
    // Node and the test runner have Web Crypto.
    return crypto.getRandomValues(new Uint8Array(count));
  }
}

interface ServerRecord {
  readonly seq: number;
  readonly author: string;
  readonly sealed: string;
}

/** The household API in memory, shared by several phones; `as(phone)` is one phone's client. */
export class FakeHouseholdServer {
  public readonly records: ServerRecord[] = [];
  public readonly members = new Set<string>();
  /** The household id each phone joined with; the fake keeps one record log for all. */
  public readonly joinedIds = new Map<string, HouseholdId>();
  public joinToken: string | null = null;
  public offline = false;
  public pageSize = 200;

  public as(phone: string): HouseholdsApiClient {
    return new FakeHouseholdsApi(this, phone);
  }
}

class FakeHouseholdsApi implements HouseholdsApiClient {
  public constructor(
    private readonly server: FakeHouseholdServer,
    private readonly phone: string,
  ) {}

  public create(joinToken: string): Promise<HouseholdResponseDto> {
    return this.reach(() => {
      // As the API: a phone is in at most one household.
      if (this.server.members.has(this.phone)) {
        throw new ApiError('conflict', 409, 'Already in a household.');
      }
      this.server.joinToken = joinToken;
      this.server.members.add(this.phone);
      return this.summary();
    });
  }

  public join(householdId: HouseholdId, joinToken: string): Promise<HouseholdResponseDto> {
    return this.reach(() => {
      if (this.server.joinToken === null) {
        throw new ApiError('not_found', 404, 'No household.');
      }
      if (joinToken !== this.server.joinToken) {
        throw new ApiError('validation_failed', 400, 'Bad token.');
      }
      if (this.server.members.has(this.phone)) {
        throw new ApiError('conflict', 409, 'Already in a household.');
      }
      this.server.members.add(this.phone);
      this.server.joinedIds.set(this.phone, householdId);
      return this.summary();
    });
  }

  public find(): Promise<HouseholdResponseDto | null> {
    return this.reach(() => (this.server.members.has(this.phone) ? this.summary() : null));
  }

  public leave(): Promise<void> {
    return this.reach(() => {
      if (!this.server.members.delete(this.phone)) {
        throw new ApiError('not_found', 404, 'Not a member.');
      }
    });
  }

  public append(sealed: readonly string[]): Promise<AppendHouseholdRecordsResponseDto> {
    return this.reach(() => {
      this.member();
      const seqs = sealed.map((record) => {
        const seq = this.server.records.length + 1;
        this.server.records.push({ seq, author: this.phone, sealed: record });
        return seq;
      });
      return { seqs };
    });
  }

  public list(afterSeq: number): Promise<HouseholdRecordListResponseDto> {
    return this.reach(() => {
      this.member();
      const after = this.server.records.filter((record) => record.seq > afterSeq);
      return {
        records: after.slice(0, this.server.pageSize).map((record) => ({
          seq: record.seq,
          sealed: record.sealed,
          mine: record.author === this.phone,
        })),
        hasMore: after.length > this.server.pageSize,
      };
    });
  }

  private member(): void {
    if (!this.server.members.has(this.phone)) {
      throw new ApiError('not_found', 404, 'Not a member.');
    }
  }

  private summary(): HouseholdResponseDto {
    return {
      householdId: this.server.joinedIds.get(this.phone) ?? HOUSEHOLD_ID,
      memberCount: this.server.members.size,
    };
  }

  private reach<T>(answer: () => T): Promise<T> {
    if (this.server.offline) {
      return Promise.reject(new ApiError('unreachable', null, 'Offline.'));
    }
    try {
      return Promise.resolve(answer());
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
