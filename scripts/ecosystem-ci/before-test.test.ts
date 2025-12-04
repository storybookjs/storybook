import { describe, expect, it } from 'vitest';

import rootPkgJson from '../../package.json';
import { EXISTING_RESOLUTIONS } from './existing-resolutions';

/*
If this test is failing for you, it means that you have changed the list of resolutions
in the root package.json, but you have not updated the EXISTING_RESOLUTIONS set in
scripts/ecosystem-ci/existing-resolutions.ts.

The purpose of this test is to ensure that any changes to the resolutions in package.json
are reflected in the EXISTING_RESOLUTIONS set, which is used by the ecosystem-ci before-test
script to copy the resolutions into the sandbox package.json files.
*/

describe('ecosystem-ci before-test', () => {
  it('EXISTING_RESOLUTIONS should match all keys in package.json resolutions', () => {
    const actualKeys = new Set(Object.keys(rootPkgJson.resolutions));
    const difference = actualKeys.symmetricDifference(EXISTING_RESOLUTIONS);

    expect(difference.size).toBe(0);
  });
});
