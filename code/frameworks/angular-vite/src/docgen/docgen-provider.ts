import type {
  DocgenProviderDescriptor,
  Manifests,
  StorybookConfigRaw,
} from '@storybook/core/internal/types';

import { fileURLToPath } from 'node:url';

import { resolvePropsTable } from '../props-table.ts';
import type { AngularDocgenOptions } from './build-docgen.ts';
import { DOCGEN_WORKER_SPECIFIER } from './worker-specifier.ts';

/** Describe the worker module with the props-table mode the framework options select. */
export function getDocgenProvider(
  frameworkOptions: Parameters<typeof resolvePropsTable>[0],
  features: StorybookConfigRaw['features']
): DocgenProviderDescriptor<AngularDocgenOptions> {
  return {
    moduleSpecifier: fileURLToPath(import.meta.resolve(DOCGEN_WORKER_SPECIFIER)),
    options: { propsTable: resolvePropsTable(frameworkOptions, features) },
  };
}

/** Mark the components manifest as Angular's when docgen server and manifest are both on. */
export function withComponentsManifest(
  existingManifests: Manifests,
  features: StorybookConfigRaw['features']
): Manifests {
  if (!features?.docgenServer || !features?.componentsManifest) {
    return existingManifests;
  }

  const existingComponents = existingManifests.components;

  return {
    ...existingManifests,
    components: {
      v: existingComponents?.v ?? 0,
      components: existingComponents?.components ?? {},
      meta: { docgen: 'angular-component-meta', durationMs: 0 },
    },
  } as Manifests;
}
