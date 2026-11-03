#!/usr/bin/env node
import path from 'node:path';
import { DefaultContractCheckerFactory } from './contract-check-factory.js';
import { ConsoleViolationReporter } from './violation-reporter.js';

const rootDir = path.resolve(process.argv[2] ?? '.');
const violations = new DefaultContractCheckerFactory().create(rootDir).check();
new ConsoleViolationReporter().report(violations);
process.exitCode = violations.length > 0 ? 1 : 0;
