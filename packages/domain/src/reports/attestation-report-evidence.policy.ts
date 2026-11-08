import type {
  ReportEvidence,
  ReportEvidenceInput,
  ReportEvidencePolicy,
} from '@amexbutikker/contracts';

export interface AttestationReportEvidencePolicyConfig {
  /**
   * Treat every device as attested. For local development and the simulator, where App Attest
   * does not exist; never in production.
   */
  readonly trustUnattested: boolean;
}

/**
 * An attested device's answer is a `user_report`, or a `visit_report` from a wallet payment. An
 * unattested device's answer is an `unverified_report`, whatever it claims to come from, so a
 * script cannot claim the stronger wallet weight.
 */
export class AttestationReportEvidencePolicy implements ReportEvidencePolicy {
  public constructor(private readonly config: AttestationReportEvidencePolicyConfig) {}

  public classify(input: ReportEvidenceInput): ReportEvidence {
    if (!input.attested && !this.config.trustUnattested) {
      return { kind: 'unverified_report', source: 'app' };
    }
    return input.via === 'wallet'
      ? { kind: 'visit_report', source: 'wallet' }
      : { kind: 'user_report', source: 'app' };
  }
}
