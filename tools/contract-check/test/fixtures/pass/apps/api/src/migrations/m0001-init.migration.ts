import type { Migration } from './migration.ports.js';

export class M0001InitMigration implements Migration {
  public up(): Promise<void> {
    return Promise.resolve();
  }
}
