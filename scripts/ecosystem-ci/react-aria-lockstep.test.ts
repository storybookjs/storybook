import { createRequire } from 'node:module';
import { join } from 'node:path';

import { satisfies } from 'semver';
import { describe, expect, it } from 'vitest';

import corePkgJson from '../../code/core/package.json';
import { ROOT_DIRECTORY } from '../utils/constants.ts';
import { readRootOverrides } from './sandbox-resolutions.ts';

/*
react-aria-components runs react-aria's `private/` modules at runtime and pins the exact
versions it shipped with. Those modules hold module-level React contexts (press, focus,
overlays), so if react-aria ever resolves to more than one copy, the contexts fork and
react-aria-components stops connecting to our components (dead popover triggers, split focus
scopes). The pnpm-workspace.yaml overrides collapse every dependent onto a single copy — which
only works while they name the exact versions react-aria-components pins. When this test fails,
update the `react-aria` / `react-stately` overrides to match the react-aria-components
release being installed (they are published in lockstep).
*/

const coreRequire = createRequire(join(import.meta.dirname, '../../code/core/package.json'));
const racPkgJson = coreRequire('react-aria-components/package.json');

const overrides = await readRootOverrides(ROOT_DIRECTORY);

describe('react-aria lockstep', () => {
  it.each(['react-aria', 'react-stately'] as const)(
    'the %s override matches the exact version react-aria-components depends on',
    (name) => {
      expect(overrides[name]).toBe(racPkgJson.dependencies[name]);
    }
  );

  it.each(['react-aria', 'react-stately'] as const)(
    'the %s override satisfies the range code/core declares',
    (name) => {
      // The manager UI is prebundled, so core declares these under devDependencies.
      expect(satisfies(overrides[name], corePkgJson.devDependencies[name])).toBe(true);
    }
  );
});
