import { NotFoundError } from '@amexbutikker/contracts';
import type {
  GetMyHousehold,
  GetMyHouseholdInput,
  HouseholdReader,
  HouseholdSummary,
} from '@amexbutikker/contracts';

export class GetMyHouseholdUseCase implements GetMyHousehold {
  public constructor(private readonly reader: HouseholdReader) {}

  public async execute(input: GetMyHouseholdInput): Promise<HouseholdSummary> {
    const membership = await this.reader.findMembership(input.userId);
    if (membership === null) {
      throw new NotFoundError('Household', 'me');
    }
    const members = await this.reader.listMembers(membership.householdId);
    return { householdId: membership.householdId, memberCount: members.length };
  }
}
