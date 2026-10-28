import { fileURLToPath } from 'node:url';

import type { DocgenProviderDescriptor } from '@storybook/core/internal/types';

/** Point core's docgen worker at the React worker module; extraction runs off the main thread. */
export function getDocgenProvider(): DocgenProviderDescriptor {
  return {
    moduleSpecifier: fileURLToPath(import.meta.resolve('@storybook/react/internal/docgen-worker')),
  };
}
