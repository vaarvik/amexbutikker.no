import { randomBytes, randomInt } from 'node:crypto';
import type {
  ChainId,
  Clock,
  EvidenceId,
  HouseholdId,
  IdGenerator,
  ImportRunId,
  PlaceId,
  UserId,
} from '@amexbutikker/contracts';

/**
 * RFC 9562 UUID version 7: 48-bit millisecond timestamp, a 12-bit sequence, then random bits.
 * Monotonic per instance (RFC 9562 section 6.2, method 1): ids from the same millisecond, or from
 * a clock that stepped back, still sort in creation order. Evidence ties are broken by id, so
 * two reports from one device in the same millisecond must not resolve at random.
 */
export class UuidV7IdGenerator implements IdGenerator {
  private static readonly maxSequence = 0xfff;
  private lastMs = -1;
  private sequence = 0;

  public constructor(private readonly clock: Clock) {}

  public placeId(): PlaceId {
    return this.next() as PlaceId;
  }

  public chainId(): ChainId {
    return this.next() as ChainId;
  }

  public userId(): UserId {
    return this.next() as UserId;
  }

  public evidenceId(): EvidenceId {
    return this.next() as EvidenceId;
  }

  public importRunId(): ImportRunId {
    return this.next() as ImportRunId;
  }

  public householdId(): HouseholdId {
    return this.next() as HouseholdId;
  }

  private next(): string {
    const now = this.clock.now().getTime();
    if (now > this.lastMs) {
      this.lastMs = now;
      // Start in the lower half so the sequence has room to count up within the millisecond.
      this.sequence = randomInt(0, (UuidV7IdGenerator.maxSequence + 1) / 2);
    } else if (this.sequence < UuidV7IdGenerator.maxSequence) {
      this.sequence += 1;
    } else {
      this.lastMs += 1;
      this.sequence = 0;
    }
    const bytes = randomBytes(16);
    bytes.writeUIntBE(this.lastMs, 0, 6);
    bytes.writeUInt16BE(0x7000 | this.sequence, 6);
    bytes.writeUInt8((bytes.readUInt8(8) & 0x3f) | 0x80, 8);
    const hex = bytes.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
}
