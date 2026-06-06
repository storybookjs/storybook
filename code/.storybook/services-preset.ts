import type { Options, StorybookConfigRaw } from 'storybook/internal/types';

import { registerOpenServiceSyncDemos } from '../core/src/shared/open-service/sync-test/server.ts';
import { registerOpenServiceDebugService } from './open-service-debug-service.ts';

/**
 * Preset hook that registers internal open-service examples and the opt-in debug service.
 *
 * Set `STORYBOOK_OPEN_SERVICE_DEBUG=true` to additionally register the debug service.
 */
export const services = async (_value: void, options: Options): Promise<void> => {
  registerOpenServiceSyncDemos();

  if (process.env.STORYBOOK_OPEN_SERVICE_DEBUG === 'true') {
    await registerOpenServiceDebugService(
      options.presets.apply<NonNullable<StorybookConfigRaw['storyIndexGenerator']>>(
        'storyIndexGenerator'
      )
    );
  }
};
