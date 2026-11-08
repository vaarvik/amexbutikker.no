import { z } from 'zod';
import type {
  Clock,
  IdGenerator,
  InputValidator,
  PlaceStatusRefresher,
  RateLimiter,
  StatusChangeOutput,
  SubmitReport,
  SubmitReportInput,
  UnitOfWork,
} from '@amexbutikker/contracts';

const NoteSchema = z.string().trim().min(1).max(500);

export class SubmitReportUseCase implements SubmitReport {
  public constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly refresher: PlaceStatusRefresher,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly rateLimiter: RateLimiter,
    private readonly validator: InputValidator,
  ) {}

  public async execute(input: SubmitReportInput): Promise<StatusChangeOutput> {
    const note = input.note === undefined ? null : this.validator.validate(NoteSchema, input.note);
    await this.rateLimiter.consume({ action: 'submit_report', key: input.userId });

    return this.unitOfWork.run(async (ports) => {
      await ports.places.getById(input.placeId);
      const id = this.ids.evidenceId();
      const now = this.clock.now();
      await ports.evidence.append({
        id,
        target: { type: 'place', placeId: input.placeId },
        ...(input.via === 'wallet'
          ? { kind: 'visit_report' as const, source: 'wallet' }
          : { kind: 'user_report' as const, source: 'app' }),
        result: input.result,
        sourceRef: id,
        observedAt: now,
        importedAt: now,
        userId: input.userId,
        note,
      });
      return this.refresher.refresh(ports, input.placeId);
    });
  }
}
