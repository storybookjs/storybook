import { fileURLToPath } from 'node:url';

import type {
  DocgenProviderDescriptor,
  Manifests,
  StorybookConfigRaw,
} from '@storybook/core/internal/types';

import { DOCGEN_WORKER_SPECIFIER } from './worker-specifier.ts';

/** Point core's docgen worker at the Svelte worker module; not registered until it ships. */
export function getDocgenProvider(): DocgenProviderDescriptor {
  return { moduleSpecifier: fileURLToPath(import.meta.resolve(DOCGEN_WORKER_SPECIFIER)) };
}

/** Add the Svelte component manifest placeholder when server docgen and manifests are on. */
export function withSvelteManifests(
  existingManifests: Manifests,
  features: StorybookConfigRaw['features']
): Manifests {
  if (!features?.docgenServer || !features?.componentsManifest) {
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
}
