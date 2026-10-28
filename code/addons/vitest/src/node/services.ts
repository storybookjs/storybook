import type { Channel } from '@storybook/core/internal/channels';
import { registerToolset } from '@storybook/core/internal/services';

import type { TestRunnerHost } from './host.ts';
import { wireTestRunResponder } from './test-run-responder.ts';
import { createTestToolset } from './toolset/definition.ts';

/** Offer the `test` toolset and answer its run requests over the channel. */
export async function registerTestServices(
  storybook: TestRunnerHost & { channel: Channel },
  a11yEnabled: boolean
): Promise<void> {
  registerToolset(
    createTestToolset({
      channel: storybook.channel,
      storyIndex: {
        getIndex: () =>
          storybook.getStoryIndexGenerator().then((generator) => generator.getIndex()),
      },
      a11yEnabled,
    })
  );

  await wireTestRunResponder({ channel: storybook.channel, storybook });
}
