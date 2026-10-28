import { defineAddon } from 'storybook/internal/instance';

import type { StoryIndexGenerator } from '../core/src/story-index/StoryIndexGenerator.ts';
import { registerOpenServiceSyncDemos } from '../core/src/shared/open-service/sync-test/server.ts';
import { registerOpenServiceDebugService } from './open-service-debug-service.ts';

/**
 * Register the internal open-service examples and the opt-in debug service.
 *
 * Set `STORYBOOK_OPEN_SERVICE_DEBUG=true` to additionally register the debug service.
 */
export const internalServices = defineAddon(() => ({
  meta: { name: 'storybook-internal-services' },
  setup(storybook): void {
    const debug = process.env.STORYBOOK_OPEN_SERVICE_DEBUG === 'true';
    const generator = Promise.withResolvers<StoryIndexGenerator>();
    storybook.hook('core:services:register', (): void => {
      registerOpenServiceSyncDemos();

      if (debug) {
        // Not awaited: the generator only exists once the instance is ready.
        void registerOpenServiceDebugService(generator.promise);
      }
    });
    if (debug) {
      storybook.hook('core:instance:ready', (): void => {
        generator.resolve(storybook.getStoryIndexGenerator());
      });
    }
  },
}));
