import { join, normalize } from 'pathe';

import { getComponentIdFromEntry } from '../../../../common/utils/component-id.ts';
import { OpenServiceDocgenMissingComponentError } from '../../../../server-errors.ts';
import type { StoryIndex } from '../../../../types/modules/indexer.ts';
import { getRegisteredServices, getService, registerService } from '../../service-registration.ts';
import { moduleGraphServiceDef } from '../module-graph/definition.ts';
import { docgenServiceDef } from './definition.ts';
import type { DocgenProvider } from './types.ts';

export type RegisterDocgenServiceOptions = {
  workingDir?: string;
  /**
   * Returns the current story index when the service needs it. Callers should bind this to a
   * pre-resolved generator so each docgen call does not re-await generator initialization.
   */
  getIndex: () => Promise<StoryIndex>;
  /**
   * Fully composed docgen provider chain produced by
   * `presets.apply('experimental_docgenProvider', ...)`. May return `undefined` when no provider
   * in the chain has docgen for the requested file.
   */
  provider: DocgenProvider;
};

/**
 * Registers the docgen open service against the process-global registry.
 *
 * The `extractDocgen` command does the work: it reads the story index, picks an entry for the
 * requested componentId, hands the entry's `importPath` to the provider chain, and stores the
 * returned payload (if any) into state. The `getDocgen` query's load hook simply invokes that
 * command. `static.inputs` enumerates every distinct componentId for the static-build pass.
 */
export function registerDocgenService(options: RegisterDocgenServiceOptions) {
  const workingDir = options.workingDir ?? process.cwd();
  const moduleGraphRegistered = getRegisteredServices().some(
    (service) => service.id === 'core/module-graph'
  );

  const runtime = registerService(docgenServiceDef, {
    queries: {
      getDocgen: {
        load: async (input, ctx) => {
          const index = await options.getIndex();
          const entry = Object.values(index.entries).find(
            (e) => getComponentIdFromEntry(e) === input.componentId
          );
          if (
            moduleGraphRegistered &&
            entry?.type === 'story' &&
            !entry.importPath.startsWith('virtual:')
          ) {
            const storyFile = normalize(join(workingDir, entry.importPath));
            ctx
              .getService<typeof moduleGraphServiceDef>('core/module-graph')
              .queries.getStoryVersion({ storyFile });
          }
          await ctx.self.commands.extractDocgen(input);
        },
        staticInputs: async () => {
          const index = await options.getIndex();
          const componentIds = new Set<string>();
          for (const entry of Object.values(index.entries)) {
            componentIds.add(getComponentIdFromEntry(entry));
          }
          return Array.from(componentIds, (componentId) => ({ componentId }));
        },
      },
    },
    commands: {
      extractDocgen: {
        handler: async (input, ctx) => {
          const index = await options.getIndex();
          const entry = Object.values(index.entries).find(
            (e) => getComponentIdFromEntry(e) === input.componentId
          );

          if (!entry) {
            throw new OpenServiceDocgenMissingComponentError({ componentId: input.componentId });
          }

          // Provider errors bubble out of the command unchanged; consumers see the underlying
          // failure rather than a generic "missing".
          const payload = await options.provider({ importPath: entry.importPath });

          if (!payload) {
            // No provider produced docgen for this file — leave state untouched and signal
            // "nothing here" to the caller.
            return undefined;
          }

          ctx.self.setState((state) => {
            state.components[input.componentId] = payload;
          });
          return payload;
        },
      },
    },
  });

  if (!moduleGraphRegistered) {
    return runtime;
  }

  const moduleGraph = getService<typeof moduleGraphServiceDef>('core/module-graph');
  let previousStoryVersions: Record<string, number> = {};
  moduleGraph.queries.getAllStoryVersions.subscribe(undefined, (versions) => {
    const bumpedStoryFiles: string[] = [];
    for (const [storyFile, version] of Object.entries(versions)) {
      if ((previousStoryVersions[storyFile] ?? 0) < version) {
        bumpedStoryFiles.push(storyFile);
      }
    }
    previousStoryVersions = { ...versions };

    if (bumpedStoryFiles.length === 0) {
      return;
    }

    void (async () => {
      const index = await options.getIndex();
      const componentIdsByStoryFile = new Map<string, Set<string>>();
      for (const entry of Object.values(index.entries)) {
        if (entry.type !== 'story' || entry.importPath.startsWith('virtual:')) {
          continue;
        }
        const storyFile = normalize(join(workingDir, entry.importPath));
        const componentId = getComponentIdFromEntry(entry);
        const ids = componentIdsByStoryFile.get(storyFile) ?? new Set<string>();
        ids.add(componentId);
        componentIdsByStoryFile.set(storyFile, ids);
      }

      for (const storyFile of bumpedStoryFiles) {
        const componentIds = componentIdsByStoryFile.get(storyFile);
        if (!componentIds) {
          continue;
        }
        for (const componentId of componentIds) {
          if (runtime.queries.getDocgen({ componentId }) === undefined) {
            continue;
          }
          await runtime.commands.extractDocgen({ componentId }).catch(() => undefined);
        }
      }
    })();
  });

  return runtime;
}
