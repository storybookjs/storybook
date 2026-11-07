import { describe, expect, it } from 'vitest';

import { ROOT_DIRECTORY } from '../utils/constants.ts';
import { EXISTING_RESOLUTIONS } from './existing-resolutions.js';
import { readRootOverrides } from './sandbox-resolutions.ts';

/*
If this test is failing for you, it means that you have changed the overrides in
pnpm-workspace.yaml, but you have not updated the EXISTING_RESOLUTIONS set in
scripts/ecosystem-ci/existing-resolutions.js.

The ecosystem-ci before-test script copies every root override that is not in EXISTING_RESOLUTIONS
into the sandbox package.json, so a missing entry would leak a monorepo-only override into the
sandboxes that ecosystem CI tests.
*/

describe('ecosystem-ci', () => {
  it('EXISTING_RESOLUTIONS should match all keys of the root overrides', async () => {
    const actualKeys = new Set(Object.keys(await readRootOverrides(ROOT_DIRECTORY)));

    expect(actualKeys.symmetricDifference(EXISTING_RESOLUTIONS)).toEqual(new Set());
  });
});
