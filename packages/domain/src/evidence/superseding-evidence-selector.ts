import type { CurrentEvidenceSelector, Evidence } from '@amexbutikker/contracts';

/** Per user only their latest evidence counts; imported evidence is superseded per (kind, source). */
export class SupersedingEvidenceSelector implements CurrentEvidenceSelector {
  public current(evidence: readonly Evidence[]): Evidence[] {
    const latest = new Map<string, Evidence>();
    for (const item of evidence) {
      const key =
        item.userId !== null ? `user:${item.userId}` : `source:${item.kind}:${item.source}`;
      const existing = latest.get(key);
      if (existing === undefined || this.isNewer(item, existing)) {
        latest.set(key, item);
      }
    }
    return [...latest.values()].filter((item) => item.result !== 'withdrawn');
  }

  /** Newer observedAt wins; ties go to newer importedAt, then the larger id. */
  private isNewer(candidate: Evidence, current: Evidence): boolean {
    const observed = candidate.observedAt.getTime() - current.observedAt.getTime();
    if (observed !== 0) {
      return observed > 0;
    }
    const imported = candidate.importedAt.getTime() - current.importedAt.getTime();
    if (imported !== 0) {
      return imported > 0;
    }
    return candidate.id > current.id;
  }
}
