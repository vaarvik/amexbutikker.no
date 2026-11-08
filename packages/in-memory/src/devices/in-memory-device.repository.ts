import { ConflictError, NotFoundError } from '@amexbutikker/contracts';
import type {
  Device,
  DeviceAttestation,
  DeviceReader,
  DeviceWriter,
  UserId,
} from '@amexbutikker/contracts';
import type { InMemoryTables } from '../shared/shared.ports.js';

export class InMemoryDeviceRepository implements DeviceReader, DeviceWriter {
  public constructor(private readonly tables: InMemoryTables) {}

  public create(device: Device): Promise<void> {
    if (this.tables.devices.has(device.userId)) {
      return Promise.reject(new ConflictError(`Device ${device.userId} is already registered.`));
    }
    this.tables.devices.set(device.userId, device);
    return Promise.resolve();
  }

  public findAttestation(userId: UserId): Promise<DeviceAttestation | null> {
    return Promise.resolve(this.tables.deviceAttestations.get(userId) ?? null);
  }

  public saveAttestation(userId: UserId, attestation: DeviceAttestation): Promise<void> {
    if (!this.tables.devices.has(userId)) {
      return Promise.reject(new NotFoundError('Device', userId));
    }
    const { keyId } = attestation;
    const taken =
      keyId !== null &&
      [...this.tables.deviceAttestations].some(
        ([other, existing]) => other !== userId && existing.keyId === keyId,
      );
    if (taken) {
      return Promise.reject(new ConflictError('This App Attest key already attested a device.'));
    }
    this.tables.deviceAttestations.set(userId, attestation);
    return Promise.resolve();
  }
}
