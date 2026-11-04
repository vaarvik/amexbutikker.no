import type { TransactionalPorts, UnitOfWork } from '@amexbutikker/contracts';
import type { ImportUnitOfWork } from './imports.ports.js';

/** Thrown inside the unit of work to roll a dry run back, carrying its result. Never leaves this file. */
class DryRunRollback extends Error {
  public constructor(public readonly result: unknown) {
    super('Dry run: roll back.');
  }
}

/** An ImportUnitOfWork over the application's UnitOfWork. */
export class TransactionalImportUnitOfWork implements ImportUnitOfWork {
  public constructor(private readonly unitOfWork: UnitOfWork) {}

  public async run<T>(
    dryRun: boolean,
    work: (ports: TransactionalPorts) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.unitOfWork.run(async (ports) => {
        const result = await work(ports);
        if (dryRun) {
          throw new DryRunRollback(result);
        }
        return result;
      });
    } catch (error) {
      if (error instanceof DryRunRollback) {
        // Only `run` throws it, with the result of this call's `work`.
        return error.result as T;
      }
      throw error;
    }
  }
}
