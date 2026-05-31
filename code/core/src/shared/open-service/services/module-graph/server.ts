import { join, normalize } from 'pathe';

import { getComponentIdFromEntry } from '../../../../common/utils/component-id.ts';
import type { StoryIndex } from '../../../../types/modules/indexer.ts';
import { registerService } from '../../service-registration.ts';
import { moduleGraphServiceDef } from './definition.ts';

export type RegisterModuleGraphServiceOptions = {
  /**
   * Returns the current story index when the service needs it. Callers should bind this to a
   * pre-resolved generator so each call does not re-await generator initialization.
   */
  getIndex: () => Promise<StoryIndex>;
  /**
   * Working directory used to turn relative `IndexEntry.importPath` values into the absolute,
   * normalized paths that the change-detection graph reports.
   */
  workingDir: string;
};

/**
 * Builds an absolute-story-file -> component-ids lookup from a story index.
 *
 * Story index entries carry a relative `importPath`; the change-detection graph reports absolute,
 * normalized paths. This resolves entries to absolute paths so the two can be matched.
 */
function buildStoryFileToComponentIds(
  index: StoryIndex,
  workingDir: string
): Map<string, Set<string>> {
  const byFile = new Map<string, Set<string>>();
  for (const entry of Object.values(index.entries)) {
    const absPath = normalize(join(workingDir, entry.importPath));
    const componentId = getComponentIdFromEntry(entry);
    const set = byFile.get(absPath) ?? new Set<string>();
    set.add(componentId);
    byFile.set(absPath, set);
  }
  return byFile;
}

/**
 * Registers the `core/module-graph` open service against the process-global registry.
 *
 * The `resolveAffectedComponents` command maps a batch of affected story files (produced by the
 * change-detection graph) to the distinct component ids they back, records them as the latest
 * invalidation, and returns them so the composition root can forward them to `core/docgen`.
 */
export function registerModuleGraphService(options: RegisterModuleGraphServiceOptions) {
  return registerService(moduleGraphServiceDef, {
    commands: {
      resolveAffectedComponents: {
        handler: async (input, ctx) => {
          const index = await options.getIndex();
          const byFile = buildStoryFileToComponentIds(index, options.workingDir);

          const componentIds = new Set<string>();
          for (const storyFile of input.storyFiles) {
            const ids = byFile.get(normalize(storyFile));
            if (ids) {
              for (const id of ids) {
                componentIds.add(id);
              }
            }
          }

          const result = {
            revision: ctx.self.state.lastAffected.revision + 1,
            componentIds: Array.from(componentIds),
          };

          ctx.self.setState((draft) => {
            draft.lastAffected = result;
          });

          return result;
        },
      },
    },
  });
}
