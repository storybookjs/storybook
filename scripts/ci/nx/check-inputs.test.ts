import { expect, it } from 'vitest';

import { checkedPackages, hashes, inParallel, loadedFiles } from './check-inputs.ts';

// A `check` that does not hash a file its TypeScript program loads restores the old result when
// only that file changes, and `nx affected` does not run it. A package type-checks what the
// packages it builds against export, so CI compiles first; locally, compile first too.
it('every check hashes the workspace files its TypeScript program loads', async () => {
  const unhashed = await inParallel(checkedPackages, async (pkg) =>
    (await loadedFiles(pkg))
      .filter((file) => !hashes(pkg, file))
      .map((file) => `${pkg.name} loads ${file}`)
  );
  // Run `yarn exec jiti scripts/ci/nx/check-inputs.ts` from the repository root.
  expect(unhashed.flat()).toEqual([]);
}, 120_000);
