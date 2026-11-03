import { DIRECT_EVIDENCE_KINDS } from '@amexbutikker/contracts';
import type {
  CurrentEvidenceSelector,
  Evidence,
  EvidenceKind,
  EvidenceSummarizer,
  EvidenceSummary,
  PlaceStatus,
  ReportNote,
  StatusBasisExplanation,
  UserId,
} from '@amexbutikker/contracts';
import { SupersedingEvidenceSelector } from '../evidence/superseding-evidence.selector.js';

const DIRECT_KINDS: ReadonlySet<EvidenceKind> = new Set(DIRECT_EVIDENCE_KINDS);

/** Summarises current evidence: the newest evidence of the basis kind explains the status. */
export class LatestEvidenceSummarizer implements EvidenceSummarizer {
  public constructor(
    private readonly selector: CurrentEvidenceSelector = new SupersedingEvidenceSelector(),
    private readonly noteLimit = 5,
  ) {}

  public summarize(
    placeEvidence: readonly Evidence[],
    chainEvidence: readonly Evidence[],
    status: PlaceStatus,
    userId: UserId | null,
  ): EvidenceSummary {
    const place = this.selector.current(placeEvidence);
    const chain = this.selector.current(chainEvidence);
    const reports = place.filter((item) => item.userId !== null && DIRECT_KINDS.has(item.kind));

    return {
      basis: this.basis(status, place, chain, reports),
      latestNotes: this.notes(reports),
      myReport: this.myReport(reports, userId),
    };
  }

  private basis(
    status: PlaceStatus,
    place: readonly Evidence[],
    chain: readonly Evidence[],
    reports: readonly Evidence[],
  ): StatusBasisExplanation {
    const counts = {
      userAccepted: reports.filter((item) => item.result === 'accepted').length,
      userRejected: reports.filter((item) => item.result === 'rejected').length,
    };
    const kind = status.basis;
    if (kind === null) {
      return { kind: null, scope: 'none', source: null, observedAt: null, ...counts };
    }
    const onPlace = this.newestOfKind(place, kind);
    const deciding = onPlace ?? this.newestOfKind(chain, kind);
    return {
      kind,
      scope: onPlace !== undefined ? 'place' : deciding !== undefined ? 'chain' : 'none',
      source: deciding?.source ?? null,
      observedAt: deciding?.observedAt ?? null,
      ...counts,
    };
  }

  private notes(reports: readonly Evidence[]): ReportNote[] {
    return reports
      .flatMap((item) =>
        item.note !== null && item.result !== 'withdrawn'
          ? [{ result: item.result, note: item.note, observedAt: item.observedAt }]
          : [],
      )
      .sort((a, b) => b.observedAt.getTime() - a.observedAt.getTime())
      .slice(0, this.noteLimit);
  }

  private myReport(
    reports: readonly Evidence[],
    userId: UserId | null,
  ): EvidenceSummary['myReport'] {
    if (userId === null) {
      return null;
    }
    const mine = reports.find((item) => item.userId === userId);
    return mine === undefined || mine.result === 'withdrawn' ? null : mine.result;
  }

  private newestOfKind(evidence: readonly Evidence[], kind: EvidenceKind): Evidence | undefined {
    return evidence
      .filter((item) => item.kind === kind)
      .reduce<Evidence | undefined>(
        (newest, item) =>
          newest === undefined || item.observedAt > newest.observedAt ? item : newest,
        undefined,
      );
  }
}
