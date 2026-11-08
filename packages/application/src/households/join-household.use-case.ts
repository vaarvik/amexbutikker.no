import { ConflictError, NotFoundError, ValidationError } from '@amexbutikker/contracts';
import { HOUSEHOLD_MAX_MEMBERS } from '@amexbutikker/contracts';
import type {
  Clock,
  HouseholdReader,
  HouseholdSummary,
  HouseholdWriter,
  JoinHousehold,
  JoinHouseholdInput,
  JoinTokenHasher,
  RateLimiter,
} from '@amexbutikker/contracts';

export class JoinHouseholdUseCase implements JoinHousehold {
  public constructor(
    private readonly reader: HouseholdReader,
    private readonly writer: HouseholdWriter,
    private readonly hasher: JoinTokenHasher,
    private readonly clock: Clock,
    private readonly rateLimiter: RateLimiter,
  ) {}

  public async execute(input: JoinHouseholdInput): Promise<HouseholdSummary> {
    // Counted before checking, so the limit also stops guessing tokens.
    await this.rateLimiter.consume({ action: 'join_household', key: input.userId });
    const household = await this.reader.findById(input.householdId);
    if (household === null) {
      throw new NotFoundError('Household', input.householdId);
    }
    if (this.hasher.hash(input.joinToken) !== household.joinTokenHash) {
      throw new ValidationError('The invite is not valid for this household.');
    }
    const current = await this.reader.findMembership(input.userId);
    const members = await this.reader.listMembers(household.id);
    if (current?.householdId === household.id) {
      return { householdId: household.id, memberCount: members.length };
    }
    if (current !== null) {
      throw new ConflictError('Leave your household before joining another.');
    }
    if (members.length >= HOUSEHOLD_MAX_MEMBERS) {
      throw new ConflictError('The household is full.');
    }
    await this.writer.saveMembership({
      householdId: household.id,
      userId: input.userId,
      joinedAt: this.clock.now(),
      leftAt: null,
    });
    return { householdId: household.id, memberCount: members.length + 1 };
  }
}
