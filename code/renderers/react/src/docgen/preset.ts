import { fileURLToPath } from 'node:url';

import { getTypeScriptSpecifierForDocgen } from 'storybook/internal/common';
import type { DocgenProviderDescriptor, Options } from 'storybook/internal/types';

import type { ReactDocgenOptions } from './docgen-worker.ts';

/**
 * React renderer docgen provider.
 *
 * Contributes a {@link DocgenProviderDescriptor} pointing at {@link ./docgen-worker.ts}, which
 * core's docgen worker imports and runs off the main thread. The renderer owns no threading code —
 * it only resolves the worker module path and hands it `typescript.docgenSpecifier`, the one
 * `typescript` option `react-component-meta` extraction reads (see {@link ./docgen-worker.ts}).
 *
 * The descriptor is appended to the accumulated array so addon providers can stack on top, mirroring
 * the previous middleware chain — just composed inside the worker instead of in this process.
 */
export const experimental_docgenProvider = async (
  existing: DocgenProviderDescriptor[] = [],
  options: Options
): Promise<DocgenProviderDescriptor[]> => {
  const descriptor: DocgenProviderDescriptor<ReactDocgenOptions> = {
    moduleSpecifier: fileURLToPath(import.meta.resolve('@storybook/react/internal/docgen-worker')),
    options: { typeScriptSpecifier: await getTypeScriptSpecifierForDocgen(options) },
  };
  return [...existing, descriptor];
};
