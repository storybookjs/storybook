import type { Options, StorybookConfigRaw } from 'storybook/internal/types';

import { registerOpenServiceDebugService } from './open-service-debug-service.ts';

/**
 * Preset hook that registers the internal open-service debug service.
 *
 * Lives in its own preset file so the `services` slot stays out of the public `StorybookConfig`
 * surface while still letting the internal Storybook self-test the registration path. Set
 * `STORYBOOK_OPEN_SERVICE_DEBUG=true` to opt in.
 */
export const services = async (_value: void, options: Options): Promise<void> => {
  if (process.env.STORYBOOK_OPEN_SERVICE_DEBUG === 'true') {
    await registerOpenServiceDebugService(
      options.presets.apply<NonNullable<StorybookConfigRaw['storyIndexGenerator']>>(
        'storyIndexGenerator'
      )
    );
  }
};
