import { fileURLToPath } from 'node:url';

import type {
  DocgenProviderDescriptor,
  IndexEntry,
  Options,
  PresetPropertyFn,
  StorybookConfigRaw,
} from 'storybook/internal/types';

import { Vue3ViteDocgenManifestError } from './errors.ts';
import { getFrameworkOptions, resolveDocgenOptions } from './options.ts';

/**
 * Vue docgen provider.
 *
 * Contributes a {@link DocgenProviderDescriptor} pointing at `@storybook/vue3/internal/docgen-worker`
 */
export const experimental_docgenProvider = async (
  existing: DocgenProviderDescriptor[] = [],
  options: Options
): Promise<DocgenProviderDescriptor[]> => {
  const [frameworkOptions, features] = await Promise.all([
    getFrameworkOptions(options),
    options.presets.apply('features', {}),
  ]);
  const docgen = resolveDocgenOptions(frameworkOptions.docgen);

  if (
    !features?.experimentalDocgenServer ||
    docgen === false ||
    docgen.plugin !== 'vue-component-meta'
  ) {
    return existing;
  }

  return [
    ...existing,
    {
      moduleSpecifier: fileURLToPath(import.meta.resolve('@storybook/vue3/internal/docgen-worker')),
    },
  ];
};

export const experimental_manifests: PresetPropertyFn<
  'experimental_manifests',
  StorybookConfigRaw,
  { manifestEntries: IndexEntry[]; watch: boolean }
> = async (existingManifests = {}, options) => {
  const [frameworkOptions, features] = await Promise.all([
    getFrameworkOptions(options),
    options.presets.apply('features', {}),
  ]);
  const docgen = resolveDocgenOptions(frameworkOptions.docgen);

  if (
    features?.experimentalDocgenServer === true &&
    features.componentsManifest === true &&
    (docgen === false || docgen.plugin !== 'vue-component-meta')
  ) {
    throw new Vue3ViteDocgenManifestError();
  }

  if (
    !features?.experimentalDocgenServer ||
    docgen === false ||
    docgen.plugin !== 'vue-component-meta'
  ) {
    return existingManifests;
  }

  return {
    ...existingManifests,
    components: {
      v: 0,
      components: {},
      meta: { docgen: 'vue-component-meta', durationMs: 0 },
    },
  };
};
