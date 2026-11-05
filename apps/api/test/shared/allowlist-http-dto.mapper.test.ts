import { TestData } from '@amexbutikker/contracts/test-kit';
import { describe, expect, it } from 'vitest';
import { AllowlistHttpDtoMapper } from '../../src/shared/allowlist-http-dto.mapper.js';

describe('DefaultHttpDtoMapper', () => {
  it('maps a status change with a chain hint', () => {
    const data = new TestData();
    const chainId = data.chainId();
    const { status } = data.statusSnapshot(data.placeId());

    const dto = new AllowlistHttpDtoMapper().statusChange({
      status,
      chainHint: data.chainHint(chainId, { acceptedCount: 7, totalWithEvidence: 9 }),
    });

    expect(dto).toEqual({
      status: {
        status: 'accepted',
        confidence: 0.9,
        basis: 'user_report',
        verified: false,
        lastEvidenceAt: status.lastEvidenceAt?.toISOString(),
      },
      chainHint: { chainId, acceptedCount: 7, totalWithEvidence: 9 },
    });
  });
});
