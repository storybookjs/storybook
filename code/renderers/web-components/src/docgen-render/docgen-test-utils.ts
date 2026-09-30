import type { DocgenPayload } from 'storybook/internal/types';

import { Channel, setChannel } from 'storybook/internal/channels';
import { registerService } from 'storybook/preview-api';
import { vi } from 'vitest';

import { docgenServiceDef } from '../../../../core/src/shared/open-service/services/docgen/definition.ts';

export function registerDocgenPayload(payload: DocgenPayload): ReturnType<typeof vi.fn> {
  const handler = vi.fn();

  // happy-dom has no addons channel, so registerService throws without one.
  setChannel(new Channel({ transport: { setHandler: vi.fn(), send: vi.fn() } }));
  registerService(docgenServiceDef, {
    commands: {
      extractDocgen: {
        handler: async (input, ctx) => {
          handler();
          const payloadForInput = { ...payload, id: input.id };
          ctx.self.setState((state) => {
            state.components[input.id] = payloadForInput;
          });
          return payloadForInput;
        },
      },
    },
  });

  return handler;
}
