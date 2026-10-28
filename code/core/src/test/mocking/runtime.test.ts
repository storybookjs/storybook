import { existsSync } from 'node:fs';

import { expect, it } from 'vitest';

import { getMockerRuntimePath } from './runtime.ts';

it('locates the bundled mocker runtime by path', () => {
  const path = getMockerRuntimePath();
  expect(path.endsWith('/core/dist/test/mocking/mocker-runtime.js')).toBe(true);
  expect(existsSync(path)).toBe(true);
});
