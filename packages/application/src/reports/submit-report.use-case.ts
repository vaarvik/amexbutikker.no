import { z } from 'zod';
import type {
  Clock,
  DeviceReader,
  IdGenerator,
  InputValidator,
  PlaceStatusRefresher,
  RateLimiter,
  ReportEvidencePolicy,
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
    private readonly devices: DeviceReader,
    private readonly policy: ReportEvidencePolicy,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly rateLimiter: RateLimiter,
    private readonly validator: InputValidator,
  ) {}

  public async execute(input: SubmitReportInput): Promise<StatusChangeOutput> {
    const note = input.note === undefined ? null : this.validator.validate(NoteSchema, input.note);
    await this.rateLimiter.consume({ action: 'submit_report', key: input.userId });
    const evidence = this.policy.classify({
      via: input.via ?? 'app',
      attested: (await this.devices.findAttestation(input.userId)) !== null,
    });

    return this.unitOfWork.run(async (ports) => {
      await ports.places.getById(input.placeId);
      const id = this.ids.evidenceId();
      const now = this.clock.now();
      await ports.evidence.append({
        id,
        target: { type: 'place', placeId: input.placeId },
        ...evidence,
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
