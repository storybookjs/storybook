import { fileURLToPath } from 'node:url';

import type { DocgenProviderDescriptor } from 'storybook/internal/types';

/**
 * Angular renderer docgen provider.
 *
 * Contributes a {@link DocgenProviderDescriptor} pointing at {@link ./docgen-worker.ts}, which
 * core's docgen worker imports and runs off the main thread. The descriptor is appended to the
 * accumulated array so addon providers can stack on top, mirroring `@storybook/react`'s
 * `experimental_docgenProvider`.
 */
export const experimental_docgenProvider = async (
  existing: DocgenProviderDescriptor[] = []
): Promise<DocgenProviderDescriptor[]> => [
  ...existing,
  {
    moduleSpecifier: fileURLToPath(
      import.meta.resolve('@storybook/angular-vite/internal/docgen-worker')
    ),
  },
];
