import { getComponentIdFromEntry } from '../../../../common/utils/component-id.ts';
import { OpenServiceDocgenMissingComponentError } from '../../../../server-errors.ts';
import type { StoryIndex } from '../../../../types/modules/indexer.ts';
import { registerService } from '../../service-registration.ts';
import { docgenServiceDef } from './definition.ts';
import type { DocgenProvider } from './types.ts';

export type RegisterDocgenServiceOptions = {
  /**
   * Returns the current story index when the service needs it. Callers should bind this to a
   * pre-resolved generator so each docgen call does not re-await generator initialization.
   */
  getIndex: () => Promise<StoryIndex>;
  /**
   * Fully composed docgen provider chain produced by `presets.apply('experimental_docgenProvider', ...)`.
   * Wraps each registered preset on top of the identity provider seed.
   */
  provider: DocgenProvider;
};

/**
 * Registers the docgen open service against the process-global registry.
 *
 * The `extractDocgen` command does the work: it reads the story index, resolves entries for the
 * requested componentId, delegates to the composed provider chain, and writes the payload into
 * state. The `getDocgen` query's load hook simply invokes that command. `static.inputs`
 * enumerates every distinct componentId for the static-build snapshot pass.
 */
export function registerDocgenService(options: RegisterDocgenServiceOptions) {
  return registerService(docgenServiceDef, {
    queries: {
      getDocgen: {
        load: async (input, ctx) => {
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
          const entries = Object.values(index.entries).filter(
            (entry) => getComponentIdFromEntry(entry) === input.componentId
          );

          if (entries.length === 0) {
            throw new OpenServiceDocgenMissingComponentError({ componentId: input.componentId });
          }

          // Provider errors bubble out of the command unchanged; consumers see the underlying
          // failure rather than a generic "missing".
          const payload = await options.provider({
            componentId: input.componentId,
            entries,
          });

          ctx.self.setState((draft) => {
            draft.components[input.componentId] = payload;
          });
        },
      },
    },
  });
}
