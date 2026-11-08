import { NotFoundError } from '@amexbutikker/contracts';
import type {
  HouseholdReader,
  ListHouseholdRecords,
  ListHouseholdRecordsInput,
  ListHouseholdRecordsOutput,
} from '@amexbutikker/contracts';

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

export class ListHouseholdRecordsUseCase implements ListHouseholdRecords {
  public constructor(private readonly reader: HouseholdReader) {}

  public async execute(input: ListHouseholdRecordsInput): Promise<ListHouseholdRecordsOutput> {
    const membership = await this.reader.findMembership(input.userId);
    if (membership === null) {
      throw new NotFoundError('Household', 'me');
    }
    const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    // One extra tells whether there is more.
    const records = await this.reader.listRecords(
      membership.householdId,
      Math.max(input.afterSeq, 0),
      limit + 1,
    );
    return {
      records: records.slice(0, limit).map((record) => ({
        seq: record.seq,
        sealed: record.sealed,
        mine: record.authorId === input.userId,
      })),
      hasMore: records.length > limit,
    };
  }
}
