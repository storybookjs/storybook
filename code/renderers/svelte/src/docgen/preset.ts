import { fileURLToPath } from 'node:url';

import type {
  DocgenProviderDescriptor,
  IndexEntry,
  Options,
  PresetPropertyFn,
  StorybookConfigRaw,
} from 'storybook/internal/types';

import { DOCGEN_WORKER_SPECIFIER } from './worker-specifier.ts';

export const experimental_docgenProvider = async (
  existing: DocgenProviderDescriptor[] = [],
  options: Options
): Promise<DocgenProviderDescriptor[]> => {
  const features = await options.presets.apply('features', {});

  if (!features?.experimentalDocgenServer) {
    return existing;
  }

  return [
    ...existing,
    { moduleSpecifier: fileURLToPath(import.meta.resolve(DOCGEN_WORKER_SPECIFIER)) },
  ];
};

export const experimental_manifests: PresetPropertyFn<
  'experimental_manifests',
  StorybookConfigRaw,
  { manifestEntries: IndexEntry[]; watch: boolean }
> = async (existingManifests = {}, options) => {
  const features = await options.presets.apply('features', {});

  if (!features?.experimentalDocgenServer || !features?.componentsManifest) {
    return existingManifests;
  }

  return {
    ...existingManifests,
    components: {
      v: 0,
      components: {},
      meta: { docgen: 'svelte2tsx', durationMs: 0 },
    },
  };
};
