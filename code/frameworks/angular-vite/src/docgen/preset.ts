import type {
  DocgenProviderDescriptor,
  IndexEntry,
  Manifests,
  Options,
  StorybookConfigRaw,
  PresetPropertyFn,
} from 'storybook/internal/types';

import { fileURLToPath } from 'node:url';

import { resolveCompodocConfig } from '../compodoc-config.ts';
import type { AngularDocgenOptions } from './build-docgen.ts';

/**
 * Contributes a {@link DocgenProviderDescriptor} pointing at {@link ./docgen-worker.ts}, which
 * core's docgen worker imports and runs off the main thread. The descriptor's `options` carry the
 * values the worker cannot derive on its own; see {@link AngularDocgenOptions}.
 */
export const experimental_docgenProvider = async (
  existing: DocgenProviderDescriptor[] = [],
  options?: Options
): Promise<DocgenProviderDescriptor[]> => {
  const features = await options?.presets?.apply('features', {});

  // Core only applies this preset when the flag is on, so this is a second gate rather than the
  // only one.
  if (!features?.experimentalDocgenServer) {
    return existing;
  }

  const compodocConfig = await resolveCompodocConfig(options);

  // Opting out of Compodoc is a static setting, so it is decided once here: no descriptor means no
  // worker module to import and no per-component branch to evaluate.
  if (!compodocConfig.enabled) {
    return existing;
  }

  const descriptor: DocgenProviderDescriptor<AngularDocgenOptions> = {
    moduleSpecifier: fileURLToPath(
      import.meta.resolve('@storybook/angular-vite/internal/docgen-worker')
    ),
    // Structured-cloned onto the worker thread: plain JSON only, no closures or class instances.
    options: {
      outputDir: compodocConfig.outputDir,
      compodocArgs: compodocConfig.compodocArgs,
      workspaceRoot: compodocConfig.workspaceRoot,
      angularFilterNonInputControls: features?.angularFilterNonInputControls,
      tsconfig: compodocConfig.tsconfig,
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
      meta: { docgen: 'compodoc', durationMs: 0 },
    },
  } as Manifests;
};
