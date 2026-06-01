import type { Options, StorybookConfigRaw } from 'storybook/internal/types';

import { registerBackgroundService } from './background-service/server.ts';
import { registerOpenServiceDebugService } from './open-service-debug-service.ts';

/**
 * Preset hook that registers internal open-service examples and the debug service.
 *
 * Set `STORYBOOK_OPEN_SERVICE_DEBUG=true` to enable all examples.
 */
export const services = async (_value: void, options: Options): Promise<void> => {
  registerBackgroundService();

  if (process.env.STORYBOOK_OPEN_SERVICE_DEBUG === 'true') {
    await registerOpenServiceDebugService(
      options.presets.apply<NonNullable<StorybookConfigRaw['storyIndexGenerator']>>(
        'storyIndexGenerator'
      )
    );
  }
};
