import { selectComponentEntriesByComponentId } from '../../../../common/utils/select-component-entry.ts';
import { OpenServiceDocgenMissingComponentError } from '../../../../server-errors.ts';
import type { StoryIndex } from '../../../../types/modules/indexer.ts';
import { getService, registerService } from '../../server.ts';
import type { ModuleGraphService } from '../module-graph/definition.ts';
import { subscribeStoryFileChangeRefresh } from '../subscribe-story-file-change-refresh.ts';
import { storyDocsServiceDef } from './definition.ts';
import type { StoryDocsPayload, StoryDocsProvider } from './types.ts';

export type RegisterStoryDocsServiceOptions = {
  workingDir?: string;
  /**
   * Returns the current story index when the service needs it. Callers should bind this to a
   * pre-resolved generator so each story-docs call does not re-await generator initialization.
   */
  getIndex: () => Promise<StoryIndex>;
  /**
   * Fully composed story-docs provider chain produced by
   * `presets.apply('experimental_storyDocsProvider', ...)`.
   */
  provider: StoryDocsProvider;
};

/**
 * Registers the story-docs open service against the process-global registry.
 *
 * Requires the `core/module-graph` service to be registered (it always is in the dev server); we
 * subscribe to it to keep already-extracted story docs fresh when source files change.
 */
export function registerStoryDocsService(options: RegisterStoryDocsServiceOptions) {
  const workingDir = options.workingDir ?? process.cwd();
  const extractedComponentIds = new Set<string>();

  const runtime = registerService(storyDocsServiceDef, {
    queries: {
      getStoryDocs: {
        staticInputs: async () => {
          const index = await options.getIndex();
          const eligible = selectComponentEntriesByComponentId(Object.values(index.entries));
          return Array.from(eligible.keys(), (id) => ({ id }));
        },
      },
    },
    commands: {
      extractStoryDocs: {
        handler: async (input, ctx) => {
          const index = await options.getIndex();
          const entry = selectComponentEntriesByComponentId(Object.values(index.entries)).get(
            input.id
          );

          if (!entry) {
            throw new OpenServiceDocgenMissingComponentError({ id: input.id });
          }

          const payload = await options.provider({ entry });

          if (!payload) {
            return undefined;
          }

          ctx.self.setState((state) => {
            state.components[input.id] = payload;
          });
          extractedComponentIds.add(input.id);
          return payload;
        },
      },
      extractAllStoryDocs: {
        handler: async (_input, ctx) => {
          const index = await options.getIndex();
          const ids = Array.from(
            selectComponentEntriesByComponentId(Object.values(index.entries)).keys()
          );
          await Promise.all(ids.map((id) => ctx.self.commands.extractStoryDocs({ id })));
        },
      },
    },
  });

  const moduleGraph = getService<ModuleGraphService>('core/module-graph');

  subscribeStoryFileChangeRefresh(moduleGraph, {
    workingDir,
    getIndex: options.getIndex,
    hasExtractedPayload: (id) => extractedComponentIds.has(id),
    refreshComponent: (id) => runtime.commands.extractStoryDocs({ id }),
  });

  return runtime;
}
