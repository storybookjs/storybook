import { fileURLToPath } from 'node:url';

import type { DocgenProviderDescriptor, Options } from 'storybook/internal/types';

import { resolveDocgenOptions } from './options.ts';

/**
 * Vue 3 Vite docgen provider.
 *
 * Contributes a {@link DocgenProviderDescriptor} pointing at {@link ./docgen-worker.ts}, which core's
 * docgen worker imports and runs off the main thread. The `tsconfig` from `framework.options.docgen`
 * travels with the descriptor because the worker has no access to the preset chain.
 *
 * `docgen: false` contributes nothing, so the preview and the docgen service agree that this project
 * has opted out. `vue-docgen-api` also contributes nothing: it is the legacy compile-time engine and
 * has no server-side counterpart, so those projects keep the Vite plugin path.
 *
 * The descriptor is appended to the accumulated array so addon providers can stack on top.
 */
export const experimental_docgenProvider = async (
  existing: DocgenProviderDescriptor[] = [],
  options: Options
): Promise<DocgenProviderDescriptor[]> => {
  const docgen = resolveDocgenOptions(await resolveFrameworkDocgenOption(options));

  if (docgen === false || docgen.plugin !== 'vue-component-meta') {
    return existing;
  }

  return [
    ...existing,
    {
      moduleSpecifier: fileURLToPath(
        import.meta.resolve('@storybook/vue3-vite/internal/docgen-worker')
      ),
      options: { tsconfigPath: docgen.tsconfig },
    },
  ];
};

async function resolveFrameworkDocgenOption(options: Options) {
  const framework = await options.presets.apply('framework');
  return typeof framework === 'string' ? undefined : framework?.options?.docgen;
}
