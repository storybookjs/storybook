import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, it } from 'vitest';

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../package.json', import.meta.url)), 'utf-8')
);

// oxc-parser loads `@oxc-parser/binding-wasm32-wasi` where no native binding exists, such as
// StackBlitz WebContainers, but no longer declares it as its own optional dependency. The binding
// only works with the oxc-parser release it was built for, so both are pinned to one version.
it('pins @oxc-parser/binding-wasm32-wasi to the exact oxc-parser version', () => {
  const version = pkg.dependencies['oxc-parser'];

  expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  expect(pkg.optionalDependencies['@oxc-parser/binding-wasm32-wasi']).toBe(version);
});
