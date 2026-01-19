import { readFileSync } from 'node:fs';

import { join } from 'pathe';

import { resolvePackageDir } from '../common';

/**
 * Returns the bundled mocker runtime script content. This is used by builders (webpack5, vite,
 * etc.) to inject the mocker runtime into the preview iframe.
 */
export function getMockerRuntime(): string {
  return readFileSync(
    join(resolvePackageDir('storybook'), 'dist', 'mocking-utils', 'mocker-runtime.js'),
    'utf-8'
  );
}
