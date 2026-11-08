import { ConflictError } from '@amexbutikker/contracts';
import type {
  Clock,
  CreateHousehold,
  CreateHouseholdInput,
  HouseholdReader,
  HouseholdSummary,
  HouseholdWriter,
  IdGenerator,
  JoinTokenHasher,
  RateLimiter,
} from '@amexbutikker/contracts';

export class CreateHouseholdUseCase implements CreateHousehold {
  public constructor(
    private readonly reader: HouseholdReader,
    private readonly writer: HouseholdWriter,
    private readonly hasher: JoinTokenHasher,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly rateLimiter: RateLimiter,
  ) {}

  public async execute(input: CreateHouseholdInput): Promise<HouseholdSummary> {
    if ((await this.reader.findMembership(input.userId)) !== null) {
      throw new ConflictError('Leave your household before creating another.');
    }
    await this.rateLimiter.consume({ action: 'create_household', key: input.userId });
    const now = this.clock.now();
    const id = this.ids.householdId();
    await this.writer.create({
      id,
      joinTokenHash: this.hasher.hash(input.joinToken),
      createdAt: now,
    });
    await this.writer.saveMembership({
      householdId: id,
      userId: input.userId,
      joinedAt: now,
      leftAt: null,
    });
    return { householdId: id, memberCount: 1 };
  }
}
