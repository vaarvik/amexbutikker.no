import { randomBytes } from 'node:crypto';
import type {
  ChainId,
  Clock,
  EvidenceId,
  IdGenerator,
  ImportRunId,
  PlaceId,
  UserId,
} from '@amexbutikker/contracts';

/** RFC 9562 UUID version 7: 48-bit millisecond timestamp, then random bits. Sorts by creation time. */
export class UuidV7IdGenerator implements IdGenerator {
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

  private next(): string {
    const bytes = randomBytes(16);
    bytes.writeUIntBE(this.clock.now().getTime(), 0, 6);
    bytes.writeUInt8((bytes.readUInt8(6) & 0x0f) | 0x70, 6);
    bytes.writeUInt8((bytes.readUInt8(8) & 0x3f) | 0x80, 8);
    const hex = bytes.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
}
