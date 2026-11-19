import type { Migration, MigrationProvider } from 'kysely/migration';
import { M0001ExtensionsMigration } from './m0001-extensions.migration.js';
import { M0002ChainsAndPlacesMigration } from './m0002-chains-and-places.migration.js';
import { M0003EvidenceMigration } from './m0003-evidence.migration.js';
import { M0004StatusImportsDevicesMigration } from './m0004-status-imports-devices.migration.js';
import { M0005ApplicationRoleMigration } from './m0005-application-role.migration.js';
import { M0006PlacesNormalizedNameMigration } from './m0006-places-normalized-name.migration.js';
import { M0007TrigramOperatorCostsMigration } from './m0007-trigram-operator-costs.migration.js';
import { M0008UnmatchedDescriptorsMigration } from './m0008-unmatched-descriptors.migration.js';
import { M0009LikelyStatusesMigration } from './m0009-likely-statuses.migration.js';
import { M0010DeviceAttestationMigration } from './m0010-device-attestation.migration.js';
import { M0011HouseholdsMigration } from './m0011-households.migration.js';
import { M0012PasskeysMigration } from './m0012-passkeys.migration.js';

/**
 * Every migration, keyed so that string order is execution order. Add new ones at the end.
 * Kysely copies migration objects with spread, which drops class methods, so each class is
 * handed over as a plain `{ up, down }` object bound to its instance.
 */
export class AllMigrationsProvider implements MigrationProvider {
  public getMigrations(): Promise<Record<string, Migration>> {
    const migrations: Record<string, Required<Migration>> = {
      '0001_extensions': new M0001ExtensionsMigration(),
      '0002_chains_and_places': new M0002ChainsAndPlacesMigration(),
      '0003_evidence': new M0003EvidenceMigration(),
      '0004_status_imports_devices': new M0004StatusImportsDevicesMigration(),
      '0005_application_role': new M0005ApplicationRoleMigration(),
      '0006_places_normalized_name': new M0006PlacesNormalizedNameMigration(),
      '0007_trigram_operator_costs': new M0007TrigramOperatorCostsMigration(),
      '0008_unmatched_descriptors': new M0008UnmatchedDescriptorsMigration(),
      '0009_likely_statuses': new M0009LikelyStatusesMigration(),
      '0010_device_attestation': new M0010DeviceAttestationMigration(),
      '0011_households': new M0011HouseholdsMigration(),
      '0012_passkeys': new M0012PasskeysMigration(),
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
