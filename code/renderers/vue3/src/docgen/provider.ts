import { fileURLToPath } from 'node:url';

import type {
  DocgenProviderDescriptor,
  Manifests,
  StorybookConfigRaw,
} from '@storybook/core/internal/types';

import type { VueDocgenPlugin } from '../types.ts';
import { DOCGEN_WORKER_SPECIFIER } from './worker-specifier.ts';

const VUE_COMPONENT_META = 'vue-component-meta' satisfies VueDocgenPlugin;

/** Point core's docgen worker at the Vue worker module. */
export function getDocgenProvider(): DocgenProviderDescriptor {
  return { moduleSpecifier: fileURLToPath(import.meta.resolve(DOCGEN_WORKER_SPECIFIER)) };
}

/** Declares the Vue component manifest engine when server docgen is on. */
export function getManifests(
  existingManifests: Manifests,
  features: StorybookConfigRaw['features']
): Manifests {
  if (features?.docgenServer !== true) {
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
}
