import { readFileSync } from 'node:fs';

import { resolvePackageDir } from 'storybook/internal/common';

import { join } from 'pathe';

export function getMockerRuntime() {
  return readFileSync(
    join(resolvePackageDir('storybook'), 'assets', 'server', 'mocker-runtime.bundled.js'),
    'utf-8'
  );
}
