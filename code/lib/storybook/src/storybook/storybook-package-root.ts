import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { findPackageRoot } from '@storybook/core/internal/common';

import { dirname } from 'pathe';

/** Root of the `storybook` package this process runs, as a realpathed normalized path. */
export function findStorybookPackageRoot(): string | undefined {
  return findPackageRoot(dirname(fileURLToPath(import.meta.url)), 'storybook');
}

/** Root of the `@storybook/core` package this process runs, as a realpathed normalized path. */
export function findCorePackageRoot(): string | undefined {
  try {
    const manifest = createRequire(import.meta.url).resolve('@storybook/core/package.json');
    return findPackageRoot(dirname(manifest), '@storybook/core');
  } catch {
    return undefined;
  }
}
