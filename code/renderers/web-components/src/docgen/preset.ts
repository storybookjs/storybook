import type {
  DocgenProviderDescriptor,
  IndexEntry,
  Options,
  PresetPropertyFn,
  StorybookConfigRaw,
} from 'storybook/internal/types';

import { fileURLToPath } from 'node:url';

import type { WebComponentsDocgenOptions } from './component-docgen/build-docgen.ts';
import {
  resolveManifestPaths,
  type WebComponentsFrameworkOptions,
} from './component-docgen/config/resolve-manifest-paths.ts';
import { DOCGEN_WORKER_SPECIFIER } from './worker-specifier.ts';

export const experimental_docgenProvider = async (
  existing: DocgenProviderDescriptor[] = [],
  options: Options
): Promise<DocgenProviderDescriptor[]> => {
  const features = await options.presets.apply('features', {});

  if (!features?.experimentalDocgenServer) {
    return existing;
  }

  const frameworkOptions =
    (await options.presets.apply<WebComponentsFrameworkOptions | null | undefined>(
      'frameworkOptions'
    )) ?? {};
  const descriptor: DocgenProviderDescriptor<WebComponentsDocgenOptions> = {
    moduleSpecifier: fileURLToPath(import.meta.resolve(DOCGEN_WORKER_SPECIFIER)),
    options: {
      manifestPaths: resolveManifestPaths(options.configDir, frameworkOptions),
    },
  };

  return [...existing, descriptor];
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
      meta: { docgen: 'custom-elements-manifest', durationMs: 0 },
    },
  };
};
