import { NotFoundError } from '@amexbutikker/contracts';
import type {
  Clock,
  CurrentEvidenceSelector,
  IdGenerator,
  PlaceStatusRefresher,
  RateLimiter,
  RemoveMyReport,
  RemoveMyReportInput,
  StatusChangeOutput,
  UnitOfWork,
} from '@amexbutikker/contracts';

export class RemoveMyReportUseCase implements RemoveMyReport {
  public constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly refresher: PlaceStatusRefresher,
    private readonly selector: CurrentEvidenceSelector,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly rateLimiter: RateLimiter,
  ) {}

  public async execute(input: RemoveMyReportInput): Promise<StatusChangeOutput> {
    await this.rateLimiter.consume({ action: 'submit_report', key: input.userId });

    return this.unitOfWork.run(async (ports) => {
      await ports.places.getById(input.placeId);
      const current = this.selector.current(await ports.evidence.listForPlace(input.placeId));
      if (!current.some((evidence) => evidence.userId === input.userId)) {
        throw new NotFoundError('Report', `${input.placeId}/${input.userId}`);
      }
      const id = this.ids.evidenceId();
      const now = this.clock.now();
      await ports.evidence.append({
        id,
        target: { type: 'place', placeId: input.placeId },
        kind: 'user_report',
        result: 'withdrawn',
        source: 'app',
        sourceRef: id,
        observedAt: now,
        importedAt: now,
        userId: input.userId,
        note: null,
      });
      return this.refresher.refresh(ports, input.placeId);
    });
  }
}
