import { VERSION } from 'rolldown';
import { minVersion, satisfies } from 'semver';
import { expect, it } from 'vitest';

import packageJson from '../../../package.json' with { type: 'json' };

const range = packageJson.dependencies.rolldown;

it('runs on a Rolldown version that the range in package.json allows', () => {
  expect(satisfies(VERSION, range)).toBe(true);
});

it.runIf(process.env.ROLLDOWN_OLDEST)('runs on the oldest version of that range', () => {
  expect(VERSION).toBe(minVersion(range)?.version);
});
