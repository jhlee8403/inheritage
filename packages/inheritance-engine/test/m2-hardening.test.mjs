import test from 'node:test';
import { hardeningCases } from './browser/m2-hardening-suite.mjs';
for (const [name, action] of hardeningCases) test(name, action);
