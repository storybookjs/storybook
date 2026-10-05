import { fileURLToPath } from 'node:url';

import type {
  DocgenProviderDescriptor,
  IndexEntry,
  Options,
  PresetPropertyFn,
  StorybookConfigRaw,
} from 'storybook/internal/types';

import type { VueDocgenPlugin } from '../types.ts';
import { DOCGEN_WORKER_SPECIFIER } from './worker-specifier.ts';

const VUE_COMPONENT_META = 'vue-component-meta' satisfies VueDocgenPlugin;

/** Contributes the Vue docgen worker descriptor. */
export const experimental_docgenProvider = async (
  existing: DocgenProviderDescriptor[] = [],
  options: Options
): Promise<DocgenProviderDescriptor[]> => {
  const features = await options.presets.apply('features', {});

  if (features?.experimentalDocgenServer !== true) {
    return existing;
  }

  return [
    ...existing,
    {
      moduleSpecifier: fileURLToPath(import.meta.resolve(DOCGEN_WORKER_SPECIFIER)),
    },
  ];
};

/** Declares the Vue component manifest engine. */
export const experimental_manifests: PresetPropertyFn<
  'experimental_manifests',
  StorybookConfigRaw,
  { manifestEntries: IndexEntry[]; watch: boolean }
> = async (existingManifests = {}, options) => {
  const features = await options.presets.apply('features', {});

  if (features?.experimentalDocgenServer !== true) {
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
