import { describe, expect, it } from 'vitest';
import { AttestationReportEvidencePolicy } from '../../src/index.js';

describe('AttestationReportEvidencePolicy', () => {
  const policy = new AttestationReportEvidencePolicy({ trustUnattested: false });

  it('counts an attested answer from the app as a user report', () => {
    expect(policy.classify({ via: 'app', attested: true })).toEqual({
      kind: 'user_report',
      source: 'app',
    });
  });

  it('counts an attested wallet payment as a visit', () => {
    expect(policy.classify({ via: 'wallet', attested: true })).toEqual({
      kind: 'visit_report',
      source: 'wallet',
    });
  });

  it.each(['app', 'wallet'] as const)(
    'counts an answer via %s from an unattested device as unverified, from the app',
    (via) => {
      expect(policy.classify({ via, attested: false })).toEqual({
        kind: 'unverified_report',
        source: 'app',
      });
    },
  );

  it('trusts every device when configured to (local development, the simulator)', () => {
    const trusting = new AttestationReportEvidencePolicy({ trustUnattested: true });

    expect(trusting.classify({ via: 'wallet', attested: false })).toEqual({
      kind: 'visit_report',
      source: 'wallet',
    });
    expect(trusting.classify({ via: 'app', attested: false }).kind).toBe('user_report');
  });
});
