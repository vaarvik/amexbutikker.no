import type { TransactionalPorts } from '@amexbutikker/contracts';

/** The transaction an importer runs in. */
export interface ImportUnitOfWork {
  /**
   * Runs `work` in one transaction. Commits when it resolves, unless `dryRun`; a dry run always
   * rolls back, so it reports exactly what a real run would do and writes nothing.
   *
   * @returns what `work` resolved with, also for a dry run.
   * @throws whatever `work` threw, after rolling back.
   */
  run<T>(dryRun: boolean, work: (ports: TransactionalPorts) => Promise<T>): Promise<T>;
}

/** Reads a whole text file, e.g. a curated claim file. */
export interface TextFileLoader {
  /** @throws Error when the file cannot be read. */
  load(path: string): Promise<string>;
}
