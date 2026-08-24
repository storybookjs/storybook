import { STORY_FILE_TEST_REGEXP, getStoryImportPathFromEntry } from 'storybook/internal/common';
import { getService } from 'storybook/internal/core-server';
import { logger } from 'storybook/internal/node-logger';
import type { StoryDocsProviderPreset } from 'storybook/internal/types';

import type { AngularDocgenPayload } from './build-docgen.ts';
import { buildStoryDocsPayload } from './story-docs-build.ts';

// `core/docgen` is only registered when `experimentalDocgenServer` set up its worker (see
// `common-preset.ts`); both services are gated by the same feature, but registration order isn't
// a type-level guarantee, so this stays defensive rather than asserting the service exists.
let warnedMissingDocgenService = false;

const resolveDocgenService = () => {
  try {
    return getService('core/docgen', { internal: true });
  } catch (error) {
    if (!warnedMissingDocgenService) {
      warnedMissingDocgenService = true;
      logger.warn(
        `Angular story snippets are unavailable: querying core/docgen failed. ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
    return undefined;
  }
};

/** Revision at which each component's docgen was last pulled, keyed by component id. */
const docgenRevisions = new Map<string, number>();

// Docgen is only stale for a component whose story subgraph changed since it was last pulled, and
// `graphRevision` reports exactly that. On the first pull the shared cache is authoritative, so the
// query is loaded rather than running a second extraction next to `core/docgen`'s own consumers;
// after a change the command's "extract now" semantics keep an HMR refresh from rebuilding snippets
// from pre-edit metadata, whichever service's refresh runs first.
const createDocgenPayloadGetter =
  (storyImportPath: string) =>
  async (componentId: string): Promise<AngularDocgenPayload | undefined> => {
    const docgenService = resolveDocgenService();
    if (!docgenService) {
      return undefined;
    }

    const revision = getService('core/module-graph', { internal: true }).queries.graphRevision.get({
      storyFiles: [storyImportPath],
    });
    const pulledAt = docgenRevisions.get(componentId);

    const payload = await (pulledAt === undefined || pulledAt === revision
      ? docgenService.queries.docgen.loaded({ id: componentId })
      : docgenService.commands.extractDocgen({ id: componentId }));
    docgenRevisions.set(componentId, revision);

    return payload;
  };

export const experimental_storyDocsProvider: StoryDocsProviderPreset = async (nextStoryDocs) => {
  return async (input) => {
    const storyImportPath = getStoryImportPathFromEntry(input.entry);
    if (!storyImportPath || !STORY_FILE_TEST_REGEXP.test(storyImportPath)) {
      return nextStoryDocs(input);
    }

    const ours = await buildStoryDocsPayload(input, {
      getDocgenPayload: createDocgenPayloadGetter(storyImportPath),
    });

    if (!ours) {
      return nextStoryDocs(input);
    }
    const downstream = await nextStoryDocs(input);
    return { ...downstream, ...ours };
  };
};
