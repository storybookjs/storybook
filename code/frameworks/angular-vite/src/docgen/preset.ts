import type {
  DocgenProviderDescriptor,
  IndexEntry,
  Manifests,
  Options,
  StorybookConfigRaw,
  PresetPropertyFn,
} from 'storybook/internal/types';

import { fileURLToPath } from 'node:url';

import type { AngularDocgenOptions } from './build-docgen.ts';

/**
 * Contributes a {@link DocgenProviderDescriptor} pointing at {@link ./docgen-worker.ts}, which
 * core's docgen worker imports and runs off the main thread. The in-process analyzer derives
 * everything from the component files themselves, so the descriptor's `options` carry only the
 * Controls filtering flag; see {@link AngularDocgenOptions}.
 */
export const experimental_docgenProvider = async (
  existing: DocgenProviderDescriptor[] = [],
  options?: Options
): Promise<DocgenProviderDescriptor[]> => {
  const features = await options?.presets?.apply('features', {});

  // Core only applies this preset when the flag is on, so this is a second gate rather than the
  // only one. `framework.options.compodoc` deliberately does not gate this provider: it governs
  // only the legacy compodoc pipeline, while the analyzer here is compodoc-free.
  if (!features?.experimentalDocgenServer) {
    return existing;
  }

  const descriptor: DocgenProviderDescriptor<AngularDocgenOptions> = {
    moduleSpecifier: fileURLToPath(
      import.meta.resolve('@storybook/angular-vite/internal/docgen-worker')
    ),
    // Structured-cloned onto the worker thread: plain JSON only, no closures or class instances.
    options: {
      angularFilterNonInputControls: features?.angularFilterNonInputControls,
    },
  };

  return [...existing, descriptor];
};

export const experimental_manifests: PresetPropertyFn<
  'experimental_manifests',
  StorybookConfigRaw,
  { manifestEntries: IndexEntry[]; watch: boolean }
> = async (existingManifests = {}, options) => {
  const features = await options?.presets?.apply('features', {});

  if (!features?.experimentalDocgenServer || !features?.componentsManifest) {
    return existingManifests as Manifests;
  }

  const existingComponents = (existingManifests as Manifests).components;

  return {
    ...existingManifests,
    components: {
      v: existingComponents?.v ?? 0,
      components: existingComponents?.components ?? {},
      meta: { docgen: 'angular-component-meta', durationMs: 0 },
    },
  } as Manifests;
};
