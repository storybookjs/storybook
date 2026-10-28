import { createRequire } from 'node:module';
import { join } from 'node:path';

import { satisfies } from 'semver';
import { describe, expect, it } from 'vitest';

import uiPkgJson from '../../code/lib/ui/package.json';
import rootPkgJson from '../../package.json';

/*
react-aria-components runs react-aria's `private/` modules at runtime and pins the exact
versions it shipped with. Those modules hold module-level React contexts (press, focus,
overlays), so if react-aria ever resolves to more than one copy, the contexts fork and
react-aria-components stops connecting to our components (dead popover triggers, split focus
scopes). The root package.json resolutions collapse every dependent onto a single copy — which
only works while they name the exact versions react-aria-components pins. When this test fails,
update the `react-aria` / `react-stately` resolutions to match the react-aria-components
release being installed (they are published in lockstep).
*/

const uiRequire = createRequire(join(import.meta.dirname, '../../code/lib/ui/package.json'));
const racPkgJson = uiRequire('react-aria-components/package.json');

describe('react-aria lockstep', () => {
  it.each(['react-aria', 'react-stately'] as const)(
    'the %s resolution matches the exact version react-aria-components depends on',
    (name) => {
      expect(rootPkgJson.resolutions[name]).toBe(racPkgJson.dependencies[name]);
    }
  );

  it.each(['react-aria', 'react-stately'] as const)(
    'the %s resolution satisfies the range code/lib/ui declares',
    (name) => {
      // The manager UI is prebundled, so core declares these under devDependencies.
      expect(satisfies(rootPkgJson.resolutions[name], uiPkgJson.devDependencies[name])).toBe(true);
    }
  );
});
