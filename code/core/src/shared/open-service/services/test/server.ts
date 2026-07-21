import type { ChannelLike } from 'storybook/internal/channels';
import type { StoryIndex } from 'storybook/internal/types';

import { registerService } from '../../server.ts';
import { testServiceDef } from './definition.ts';
import { createAsyncQueue, runStoryTests } from './run.ts';

export type RegisterTestServiceOptions = {
  channel: ChannelLike;
  getIndex: () => Promise<StoryIndex>;
};

/**
 * Registers the `core/test` open service with channel-backed `test.run` handling.
 * Concurrent runs are serialized via an async queue (addon-vitest only supports one at a time).
 */
export function registerTestService(options: RegisterTestServiceOptions) {
  const { channel, getIndex } = options;
  const queue = createAsyncQueue();

  return registerService(testServiceDef, {
    commands: {
      run: {
        handler: async (input) => {
          const done = await queue.wait();
          try {
            return await runStoryTests({
              channel,
              getIndex,
              stories: input.stories,
              a11y: input.a11y,
            });
          } finally {
            done();
          }
        },
      },
    },
  });
}
