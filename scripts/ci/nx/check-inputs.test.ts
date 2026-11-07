import { expect, it } from 'vitest';

import { checkedPackages, compiled, hashes, inParallel, loadedFiles } from './check-inputs.ts';

// `check` runs after every `compile`, and CI compiles before the unit tests; locally, compile
// first. The inputs are the same on every OS, so the Linux run covers Windows.
it.skipIf((!compiled && !process.env.CI) || process.platform === 'win32')(
  'every check hashes the workspace files its TypeScript program loads',
  async () => {
    const unhashed = await inParallel(checkedPackages, async (pkg) =>
      (await loadedFiles(pkg))
        .filter((file) => !hashes(pkg, file))
        .map((file) => `${pkg.name} loads ${file}`)
    );
    expect(unhashed.flat(), 'Run `yarn exec jiti scripts/ci/nx/check-inputs.ts`').toEqual([]);
  },
  300_000
);
