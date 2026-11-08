import type {
  Clock,
  HouseholdReader,
  HouseholdWriter,
  LeaveHousehold,
  LeaveHouseholdInput,
} from '@amexbutikker/contracts';

export class LeaveHouseholdUseCase implements LeaveHousehold {
  public constructor(
    private readonly reader: HouseholdReader,
    private readonly writer: HouseholdWriter,
    private readonly clock: Clock,
  ) {}

  public async execute(input: LeaveHouseholdInput): Promise<void> {
    const membership = await this.reader.findMembership(input.userId);
    if (membership !== null) {
      await this.writer.saveMembership({ ...membership, leftAt: this.clock.now() });
    }
  }
}
