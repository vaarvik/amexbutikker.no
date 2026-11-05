import { ConflictError } from '@amexbutikker/contracts';
import type { Device, DeviceWriter } from '@amexbutikker/contracts';
import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { Database } from '../shared/shared.model.js';
import type { DatabaseErrorTranslator } from '../shared/shared.ports.js';

export class PgDeviceRepository implements DeviceWriter {
  public constructor(
    private readonly db: Kysely<Database>,
    private readonly errors: DatabaseErrorTranslator,
  ) {}

  public async register(device: Device): Promise<void> {
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
}
