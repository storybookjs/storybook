import { readFileSync } from 'node:fs';

import { join } from 'pathe';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { COREPACK_VERSION } from './utils/helpers.ts';

const repoRoot = join(import.meta.dirname, '../..');
const ACTION = '.github/actions/setup-node-and-install';

const read = (file: string) => readFileSync(join(repoRoot, file), 'utf8');

type Step = { name?: string; uses?: string; if?: string };

describe(ACTION, () => {
  it.each([`${ACTION}/action.yml`, '.github/workflows/generate-sandboxes.yml'])(
    'installs the corepack that the CircleCI jobs pin, in %s',
    (file) => {
      const pins = [...read(file).matchAll(/corepack@(\S+)/g)].map(([, version]) => version);

      expect(pins).toEqual([COREPACK_VERSION]);
    }
  );

  it('restores and saves a cache only for Yarn checkouts', () => {
    const steps: Step[] = parse(read(`${ACTION}/action.yml`)).runs.steps;
    const cacheSteps = steps.filter(({ uses }) => uses?.startsWith('actions/cache'));

    expect(cacheSteps.length).toBeGreaterThan(0);
    for (const step of cacheSteps) {
      expect(step.if, step.name).toMatch(/steps\.package-manager\.outputs\.name == 'yarn'/);
    }
  });
});
