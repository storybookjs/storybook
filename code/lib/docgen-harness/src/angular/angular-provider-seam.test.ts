import { existsSync } from 'node:fs';
import { isAbsolute } from 'node:path';

import { expect, test } from 'vitest';

import { getDocgenProvider } from '../../../../frameworks/angular-vite/src/docgen/docgen-provider.ts';

// Requiring a real on-disk worker module is what keeps this honest: a stub export (empty array or a
// dangling descriptor) must not satisfy it.
test('angular-vite registers a docgen provider pointing at a worker module that exists', () => {
  const descriptor = getDocgenProvider(undefined, { angularFilterNonInputControls: true });

  expect(isAbsolute(descriptor.moduleSpecifier)).toBe(true);
  expect(existsSync(descriptor.moduleSpecifier)).toBe(true);
  // The worker receives exactly the props-table mode; the in-process analyzer derives everything
  // else from the component files themselves.
  expect(descriptor.options).toEqual({ propsTable: 'inputs' });
});
