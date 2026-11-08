import { ConflictError, DeviceAttestationSchema, NotFoundError } from '@amexbutikker/contracts';
import type {
  Device,
  DeviceAttestation,
  DeviceReader,
  DeviceWriter,
  UserId,
} from '@amexbutikker/contracts';
import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import { z } from 'zod';
import type { Database } from '../shared/shared.model.js';
import type { DatabaseErrorTranslator } from '../shared/shared.ports.js';

const AttestationRowSchema = z.object({
  attestation_kind: z.string().nullable(),
  attested_at: z.date().nullable(),
  app_attest_key_id: z.string().nullable(),
});

export class PgDeviceRepository implements DeviceReader, DeviceWriter {
  public constructor(
    private readonly db: Kysely<Database>,
    private readonly errors: DatabaseErrorTranslator,
  ) {}

  public async create(device: Device): Promise<void> {
    try {
      await sql`
        INSERT INTO devices (user_id, platform, created_at) VALUES (${device.userId}, ${device.platform}, ${device.createdAt})
      `.execute(this.db);
    } catch (error) {
      throw this.errors.translate(error, {
        devices_pkey: () => new ConflictError(`Device ${device.userId} is already registered.`),
      });
    }
  }

  public async findAttestation(userId: UserId): Promise<DeviceAttestation | null> {
    const { rows } = await sql`
      SELECT attestation_kind, attested_at, app_attest_key_id FROM devices WHERE user_id = ${userId}
    `.execute(this.db);
    const [raw] = rows;
    if (raw === undefined) {
      return null;
    }
    const row = AttestationRowSchema.parse(raw);
    return row.attestation_kind === null
      ? null
      : DeviceAttestationSchema.parse({
          kind: row.attestation_kind,
          attestedAt: row.attested_at,
          keyId: row.app_attest_key_id,
        });
  }

  public async saveAttestation(userId: UserId, attestation: DeviceAttestation): Promise<void> {
    try {
      const result = await sql`
        UPDATE devices
        SET attestation_kind = ${attestation.kind},
            attested_at = ${attestation.attestedAt},
            app_attest_key_id = ${attestation.keyId}
        WHERE user_id = ${userId}
      `.execute(this.db);
      if (result.numAffectedRows === 0n) {
        throw new NotFoundError('Device', userId);
      }
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw this.errors.translate(error, {
        devices_app_attest_key_id_key: () =>
          new ConflictError('This App Attest key already attested a device.'),
      });
    }
  }
}
