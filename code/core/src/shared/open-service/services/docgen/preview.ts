import { logger } from "storybook/internal/client-logger";
import type { ArgTypes } from "storybook/internal/types";

import type { ServiceInstanceOf } from "storybook/open-service";

import { getService, registerService } from "../../preview.ts";
import { docgenServiceDef } from "./definition.ts";

export type DocgenService = ServiceInstanceOf<typeof docgenServiceDef>;

/**
 * Registers the preview-side `core/docgen` runtime.
 *
 * The server owns extraction commands, while the preview owns `setCustomArgTypes` because only the
 * preview has access to normalized CSF annotations. Manager/docs consumers observe the resulting
 * state through open-service sync.
 */
export function registerPreviewDocgenService(): DocgenService {
  return registerService(docgenServiceDef, {
    commands: {
      setProjectCustomArgTypes: {
        handler: async (input, ctx) => {
          ctx.self.setState((state) => {
            state.customArgTypes.project = input.argTypes;
          });
        },
      },
      setCustomArgTypes: {
        handler: async (input, ctx) => {
          const componentId = input.storyId.split("--")[0];

          ctx.self.setState((state) => {
            const existing =
              state.customArgTypes.byComponent[componentId] ?? {};
            state.customArgTypes.byComponent[componentId] = {
              meta: input.metaArgTypes ?? existing.meta,
              stories: {
                ...existing.stories,
                [input.storyId]:
                  input.storyArgTypes ??
                  existing.stories?.[input.storyId] ??
                  {},
              },
            };
          });
        },
      },
    },
  });
}

/**
 * Pushes preview-level custom argTypes into `core/docgen`.
 *
 * Called when normalized project annotations are installed on the preview `StoryStore` — the same
 * moment legacy `prepareStory` would start combining `projectAnnotations.argTypes`.
 */
export function pushDocgenProjectCustomArgTypes(argTypes?: ArgTypes) {
  let service: DocgenService;
  try {
    service = getService("core/docgen");
  } catch {
    return;
  }

  void service.commands
    .setProjectCustomArgTypes({ argTypes })
    .catch((error) => {
      logger.debug(`Failed to push docgen project custom argTypes: ${error}`);
    });
}

/**
 * Pushes custom argTypes for a prepared story into `core/docgen`.
 *
 * Called from story preparation. Merge logic lives in the `setCustomArgTypes` command handler.
 */
export function pushDocgenCustomArgTypes({
  storyId,
  metaArgTypes,
  storyArgTypes,
}: {
  storyId: string;
  metaArgTypes?: ArgTypes;
  storyArgTypes?: ArgTypes;
}) {
  let service: DocgenService;
  try {
    service = getService("core/docgen");
  } catch {
    return;
  }

  void service.commands
    .setCustomArgTypes({
      storyId,
      metaArgTypes,
      storyArgTypes,
    })
    .catch((error) => {
      logger.debug(
        `Failed to push docgen custom argTypes for ${storyId}: ${error}`,
      );
    });
}
