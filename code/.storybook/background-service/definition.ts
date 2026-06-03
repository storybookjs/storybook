/**
 * Shared (environment-agnostic) definition for the example background-color service.
 *
 * Demonstrates the open-service multi-runtime sync pattern:
 *  - Manager registers and provides a toolbar tool to pick a color.
 *  - Preview registers and subscribes to update the document background.
 *  - Server registers and subscribes to log every color change.
 *
 * All three runtimes share this one definition and stay in sync automatically via
 * the channel sync-start initialization and patch-broadcast protocol.
 *
 * Import from here in all three contexts; never import environment-specific bits
 * (hooks, addons, node-logger) from this file.
 */

import * as v from 'valibot';

import { defineService } from 'storybook/open-service';

type BackgroundState = {
  color: string;
};

export const BACKGROUND_COLORS = [
  { label: 'Light', value: '#F8F8F8' },
  { label: 'Dark', value: '#1B1C1D' },
] as const;

export const backgroundServiceDef = defineService({
  id: 'storybook/internal/example-background',
  description:
    'Example service: controls the canvas background color and syncs across manager, preview, and server.',
  initialState: { color: '#F8F8F8' } satisfies BackgroundState,
  queries: {
    getColor: {
      description: 'Returns the current background color.',
      input: v.void(),
      output: v.string(),
      handler: (_input, ctx) => ctx.self.state.color,
    },
  },
  commands: {
    setColor: {
      description: 'Sets the background color.',
      input: v.object({ color: v.string() }),
      output: v.void(),
      handler: async (input, ctx) => {
        ctx.self.setState((state) => {
          state.color = input.color;
        });
      },
    },
  },
});
