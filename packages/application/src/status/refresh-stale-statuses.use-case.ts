import type {
  Clock,
  InputValidator,
  PlaceStatusRefresher,
  RefreshStaleStatuses,
  RefreshStaleStatusesInput,
  RefreshStaleStatusesOutput,
  UnitOfWork,
} from '@amexbutikker/contracts';
import { z } from 'zod';

const InputSchema = z.object({
  calculatedBefore: z.date(),
  batchSize: z.int().min(1).max(1000),
});

/**
 * Recalculates stale statuses in batches, one transaction per batch, oldest first. A cutoff in
 * the future is clamped to now: a freshly recalculated snapshot is then never stale again within
 * the same run, so the loop always ends.
 */
export class RefreshStaleStatusesUseCase implements RefreshStaleStatuses {
  public constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly refresher: PlaceStatusRefresher,
    private readonly clock: Clock,
    private readonly validator: InputValidator,
  ) {}

  public async execute(input: RefreshStaleStatusesInput): Promise<RefreshStaleStatusesOutput> {
    const { calculatedBefore, batchSize } = this.validator.validate(InputSchema, input);
    const now = this.clock.now();
    const cutoff = calculatedBefore.getTime() > now.getTime() ? now : calculatedBefore;
    let refreshed = 0;
    for (;;) {
      const count = await this.unitOfWork.run(async (ports) => {
        const placeIds = await ports.statuses.listStale(cutoff, batchSize);
        for (const placeId of placeIds) {
          await this.refresher.refresh(ports, placeId);
        }
        return placeIds.length;
      });
      refreshed += count;
      if (count < batchSize) {
        return { refreshed };
      }
    }
  }
}
