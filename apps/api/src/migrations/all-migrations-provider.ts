import type { Migration, MigrationProvider } from 'kysely/migration';
import { M0001Extensions } from './m0001-extensions.js';
import { M0002ChainsAndPlaces } from './m0002-chains-and-places.js';
import { M0003Evidence } from './m0003-evidence.js';
import { M0004StatusImportsDevices } from './m0004-status-imports-devices.js';
import { M0005ApplicationRole } from './m0005-application-role.js';

/**
 * Every migration, keyed so that string order is execution order. Add new ones at the end.
 * Kysely copies migration objects with spread, which drops class methods, so each class is
 * handed over as a plain `{ up, down }` object bound to its instance.
 */
export class AllMigrationsProvider implements MigrationProvider {
  public getMigrations(): Promise<Record<string, Migration>> {
    const migrations: Record<string, Required<Migration>> = {
      '0001_extensions': new M0001Extensions(),
      '0002_chains_and_places': new M0002ChainsAndPlaces(),
      '0003_evidence': new M0003Evidence(),
      '0004_status_imports_devices': new M0004StatusImportsDevices(),
      '0005_application_role': new M0005ApplicationRole(),
    };
    return Promise.resolve(
      Object.fromEntries(
        Object.entries(migrations).map(([name, migration]) => [
          name,
          { up: (db) => migration.up(db), down: (db) => migration.down(db) } satisfies Migration,
        ]),
      ),
    );
  }
}
