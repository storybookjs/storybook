import { fileURLToPath } from 'node:url';

import { DOCGEN_WORKER_SPECIFIER } from '@storybook/vue3/preset';
import type {
  DocgenProviderDescriptor,
  IndexEntry,
  Options,
  PresetPropertyFn,
  StorybookConfigRaw,
} from 'storybook/internal/types';

import { VUE_COMPONENT_META, resolveDocgenContext } from './options.ts';

/**
 * Vue docgen provider.
 *
 * Contributes a {@link DocgenProviderDescriptor} pointing at `@storybook/vue3/internal/docgen-worker`
 */
export const experimental_docgenProvider = async (
  existing: DocgenProviderDescriptor[] = [],
  options: Options
): Promise<DocgenProviderDescriptor[]> => {
  const { docgenServerActive } = await resolveDocgenContext(options);

  if (!docgenServerActive) {
    return existing;
  }

  return [
    ...existing,
    {
      moduleSpecifier: fileURLToPath(import.meta.resolve(DOCGEN_WORKER_SPECIFIER)),
    },
  ];
};

export const experimental_manifests: PresetPropertyFn<
  'experimental_manifests',
  StorybookConfigRaw,
  { manifestEntries: IndexEntry[]; watch: boolean }
> = async (existingManifests = {}, options) => {
  const { docgenServerActive } = await resolveDocgenContext(options);

  if (!docgenServerActive) {
    return existingManifests;
  }

  return {
    ...existingManifests,
    components: {
      v: 0,
      components: {},
      meta: { docgen: VUE_COMPONENT_META, durationMs: 0 },
    },
  };
};
