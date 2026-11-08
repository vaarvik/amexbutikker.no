import { NotFoundError, ValidationError } from '@amexbutikker/contracts';
import { HOUSEHOLD_RECORDS_PER_APPEND, SealedRecordSchema } from '@amexbutikker/contracts';
import type {
  AppendHouseholdRecords,
  AppendHouseholdRecordsInput,
  AppendHouseholdRecordsOutput,
  Clock,
  HouseholdReader,
  HouseholdWriter,
  RateLimiter,
} from '@amexbutikker/contracts';

export class AppendHouseholdRecordsUseCase implements AppendHouseholdRecords {
  public constructor(
    private readonly reader: HouseholdReader,
    private readonly writer: HouseholdWriter,
    private readonly clock: Clock,
    private readonly rateLimiter: RateLimiter,
  ) {}

  public async execute(input: AppendHouseholdRecordsInput): Promise<AppendHouseholdRecordsOutput> {
    if (input.sealed.length === 0 || input.sealed.length > HOUSEHOLD_RECORDS_PER_APPEND) {
      throw new ValidationError(`Send 1 to ${String(HOUSEHOLD_RECORDS_PER_APPEND)} records.`);
    }
    if (input.sealed.some((sealed) => !SealedRecordSchema.safeParse(sealed).success)) {
      throw new ValidationError('A record is not a sealed record.');
    }
    const membership = await this.reader.findMembership(input.userId);
    if (membership === null) {
      throw new NotFoundError('Household', 'me');
    }
    await this.rateLimiter.consume({ action: 'append_household_records', key: input.userId });
    const createdAt = this.clock.now();
    const records = await this.writer.appendRecords(
      input.sealed.map((sealed) => ({
        householdId: membership.householdId,
        authorId: input.userId,
        sealed,
        createdAt,
      })),
    );
    return { seqs: records.map((record) => record.seq) };
  }
}
