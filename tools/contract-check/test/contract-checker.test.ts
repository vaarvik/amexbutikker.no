import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DefaultContractCheckerFactory } from '../src/contract-check-factory.js';
import type { Violation } from '../src/violation.js';

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

function checkFixture(name: string): readonly Pick<Violation, 'ruleId' | 'file' | 'line'>[] {
  return new DefaultContractCheckerFactory()
    .create(path.join(fixturesDir, name))
    .check()
    .map(({ ruleId, file, line }) => ({ ruleId, file, line }));
}

describe('contract-check', () => {
  it('passes a workspace that follows every rule', () => {
    expect(checkFixture('pass')).toEqual([]);
  });

  it('(a) flags exported classes in application and api/src that implement no interface', () => {
    expect(checkFixture('fail-a')).toEqual([
      {
        ruleId: 'class-implements-interface',
        file: 'apps/api/src/http/places-controller.ts',
        line: 9,
      },
      {
        ruleId: 'class-implements-interface',
        file: 'packages/application/src/submit-report-use-case.ts',
        line: 1,
      },
    ]);
  });

  it('(b) flags framework, driver, SDK and apps/* imports from domain and application', () => {
    const domain = 'packages/domain/src/calculator.ts';
    const application = 'packages/application/src/locate.ts';
    expect(checkFixture('fail-b')).toEqual([
      { ruleId: 'forbidden-import', file: application, line: 1 },
      { ruleId: 'forbidden-import', file: application, line: 2 },
      { ruleId: 'forbidden-import', file: application, line: 3 },
      { ruleId: 'forbidden-import', file: application, line: 4 },
      { ruleId: 'forbidden-import', file: application, line: 7 },
      { ruleId: 'forbidden-import', file: domain, line: 2 },
      { ruleId: 'forbidden-import', file: domain, line: 3 },
      { ruleId: 'forbidden-import', file: domain, line: 4 },
      { ruleId: 'forbidden-import', file: domain, line: 9 },
    ]);
  });

  it('(c) flags `new` on application and infrastructure classes outside the composition root', () => {
    expect(checkFixture('fail-c')).toEqual([
      {
        ruleId: 'construction-outside-composition-root',
        file: 'apps/api/src/http/places-controller.ts',
        line: 10,
      },
      {
        ruleId: 'construction-outside-composition-root',
        file: 'apps/api/src/http/places-controller.ts',
        line: 11,
      },
      {
        ruleId: 'construction-outside-composition-root',
        file: 'apps/api/src/reports/http/reports-controller.ts',
        line: 9,
      },
      {
        ruleId: 'construction-outside-composition-root',
        file: 'packages/application/src/create-place-use-case.ts',
        line: 5,
      },
    ]);
  });

  it('(d) flags classes in contracts/src other than Error subclasses, outside the test kit', () => {
    expect(checkFixture('fail-d')).toEqual([
      { ruleId: 'contracts-class', file: 'packages/contracts/src/places/places.model.ts', line: 5 },
      { ruleId: 'contracts-class', file: 'packages/contracts/src/places/places.model.ts', line: 9 },
    ]);
  });

  it('(e) flags contracts files that break the feature-folder naming standard', () => {
    expect(checkFixture('fail-e')).toEqual([
      {
        ruleId: 'contracts-file-naming',
        file: 'packages/contracts/src/devices/device-ports.ts',
        line: 1,
      },
      { ruleId: 'contracts-file-naming', file: 'packages/contracts/src/ids.ts', line: 1 },
      {
        ruleId: 'contracts-file-naming',
        file: 'packages/contracts/src/places/nested/places.model.ts',
        line: 1,
      },
      {
        ruleId: 'contracts-file-naming',
        file: 'packages/contracts/src/places/queries.ts',
        line: 1,
      },
    ]);
  });
});
