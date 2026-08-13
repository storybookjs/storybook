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
import { resolvePropsTable } from '../props-table.ts';
import type { AngularDocgenOptions } from './build-docgen.ts';

/** Contribute the descriptor for the worker module core imports and runs off the main thread. */
export const experimental_docgenProvider = async (
  existing: DocgenProviderDescriptor[] = [],
  options?: Options
): Promise<DocgenProviderDescriptor[]> => {
  const features = await options?.presets?.apply('features', {});

  // `framework.options.compodoc: false` reads as "no Angular docgen", not "no Compodoc binary":
  // it is what `storybook init` and the angular-to-angular-vite automigration write on the user's
  // behalf, so honouring it here is what keeps that opt-out meaning the same thing after the
  // provider changes underneath it. Decided once, statically: no descriptor means no worker module
  // to import and no per-component branch to evaluate.
  if (!features?.experimentalDocgenServer || !(await resolveCompodocConfig(options)).enabled) {
    return existing;
  }

  const descriptor: DocgenProviderDescriptor<AngularDocgenOptions> = {
    moduleSpecifier: fileURLToPath(
      import.meta.resolve('@storybook/angular-vite/internal/docgen-worker')
    ),
    options: {
      propsTable: resolvePropsTable(await options?.presets?.apply('frameworkOptions'), features),
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
