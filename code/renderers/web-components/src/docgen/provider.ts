import { loadPreviewOrConfigFile } from '@storybook/core/internal/common';
import type {
  DocgenProviderDescriptor,
  Manifests,
  StorybookConfigRaw,
} from '@storybook/core/internal/types';

import { fileURLToPath } from 'node:url';

import type { WebComponentsFrameworkOptions } from '../types.ts';
import type { WebComponentsDocgenOptions } from './component-docgen/build-docgen.ts';
import { resolveManifestPaths } from './component-docgen/config/resolve-manifest-paths.ts';
import { DOCGEN_WORKER_SPECIFIER } from './worker-specifier.ts';

/** Describe the docgen worker with the manifest paths the framework options select. */
export function createDocgenDescriptor(
  configDir: string,
  frameworkOptions: WebComponentsFrameworkOptions | null | undefined
): DocgenProviderDescriptor<WebComponentsDocgenOptions> {
  return {
    moduleSpecifier: fileURLToPath(import.meta.resolve(DOCGEN_WORKER_SPECIFIER)),
    options: {
      manifestPaths: resolveManifestPaths(configDir, frameworkOptions ?? {}),
      previewFilePath: loadPreviewOrConfigFile({ configDir }),
    },
  };
}

/** Add the components manifest entry when server docgen serves it. */
export function withComponentsManifest(
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
      meta: { docgen: 'custom-elements-manifest', durationMs: 0 },
    },
  };
}
