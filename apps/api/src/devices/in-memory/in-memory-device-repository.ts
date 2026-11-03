import { ConflictError } from '@amexbutikker/contracts';
import type { Device, DeviceWriter } from '@amexbutikker/contracts';
import type { InMemoryTables } from '../../shared/in-memory/in-memory-tables.js';

export class InMemoryDeviceRepository implements DeviceWriter {
  public constructor(private readonly tables: InMemoryTables) {}

  public register(device: Device): Promise<void> {
    if (this.tables.devices.has(device.userId)) {
      return Promise.reject(new ConflictError(`Device ${device.userId} is already registered.`));
    }
    this.tables.devices.set(device.userId, device);
    return Promise.resolve();
  }
}
