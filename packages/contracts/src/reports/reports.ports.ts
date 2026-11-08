import type { EvidenceKind } from '../evidence/evidence.model.js';
import type { ReportChannel } from './reports.model.js';

export interface ReportEvidenceInput {
  readonly via: ReportChannel;
  /** Whether the reporting device has been attested (App Attest or Turnstile). */
  readonly attested: boolean;
}

export interface ReportEvidence {
  readonly kind: EvidenceKind;
  readonly source: string;
}

/** Decides which kind of evidence a user's answer becomes. Pure. */
export interface ReportEvidencePolicy {
  classify(input: ReportEvidenceInput): ReportEvidence;
}
