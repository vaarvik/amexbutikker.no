import { DIRECT_EVIDENCE_KINDS } from '@amexbutikker/contracts';
import type {
  ChainHint,
  ChainHintCalculator,
  ChainId,
  EvidenceKind,
  PlaceStatus,
} from '@amexbutikker/contracts';

const DIRECT_KINDS: ReadonlySet<EvidenceKind> = new Set(DIRECT_EVIDENCE_KINDS);

/**
 * "7 of 9 stores in this chain accept": among the chain's places whose status rests on direct
 * evidence, how many are accepted. Places decided by chain or external evidence are left out,
 * so the hint never feeds on itself.
 */
export class ProportionChainHintCalculator implements ChainHintCalculator {
  public calculate(chainId: ChainId, statuses: readonly PlaceStatus[], now: Date): ChainHint {
    const direct = statuses.filter(
      (status) =>
        status.status !== 'unknown' && status.basis !== null && DIRECT_KINDS.has(status.basis),
    );
    return {
      chainId,
      acceptedCount: direct.filter((status) => status.status === 'accepted').length,
      totalWithEvidence: direct.length,
      calculatedAt: now,
    };
  }
}
