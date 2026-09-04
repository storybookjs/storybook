/**
 * Local docs access with registration-based selection between the two engines.
 *
 * Docgen-server mode moves docs data out of the served manifests and into the open services, but
 * the `experimentalDocgenServer` flag alone is not enough to read from them: the docgen
 * registrations are skipped for manager-only builds and when no docgen worker is available. Every
 * consumer that reads the local Storybook — core's own docs toolset and a composition's local
 * source alike — must make the same choice, so it lives here: the services when they actually
 * registered, and otherwise the manifests, which every mode still writes.
 *
 * The registry probe runs per call, because some consumers (addon-mcp's dev-server hook) create
 * this access before the `services` preset hooks have necessarily run.
 */

import type { StoryIndex } from 'storybook/internal/types';

import { DOCGEN_SERVICE_ID } from '../../services/docgen/paths.ts';
import { STORY_DOCS_SERVICE_ID } from '../../services/story-docs/paths.ts';
import { getRegisteredServices, getService } from '../../service-registry.ts';
import type { ToolsetGetService } from '../../toolset-definition.ts';
import { createManifestDocsAccess, type RawManifests } from './access-manifest.ts';
import { createServiceDocsAccess } from './access-service.ts';
import type { DocsAccess } from './access.ts';

export type LocalDocsAccessOptions = {
  storyIndex: { getIndex: () => Promise<StoryIndex> };
  /** Reads the live inline manifests, e.g. core-server's `loadManifests`. */
  getManifests: () => Promise<RawManifests>;
};

export function createLocalDocsAccess({
  storyIndex,
  getManifests,
}: LocalDocsAccessOptions): DocsAccess {
  const serviceAccess = createServiceDocsAccess({
    storyIndex,
    getService: getService as ToolsetGetService,
  });
  const manifestAccess = createManifestDocsAccess({ getManifests });
  // The service access hard-requires every one of these; a partial registration would make every
  // call throw, so it degrades to the manifests instead of trusting that core's registration block
  // always registers them together.
  const requiredServiceIds = [DOCGEN_SERVICE_ID, STORY_DOCS_SERVICE_ID];
  const pick = () => {
    const registered = new Set(getRegisteredServices().map((service) => service.id));
    return requiredServiceIds.every((id) => registered.has(id)) ? serviceAccess : manifestAccess;
  };

  return {
    list: (options) => pick().list(options),
    resolve: (id) => pick().resolve(id),
  };
}
