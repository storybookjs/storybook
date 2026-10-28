import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import getPort from 'detect-port';

import { STORY_INDEX_INVALIDATED } from '@storybook/core/internal/core-events';
import { buildDevStandalone } from './build-dev.ts';

vi.unmock('@storybook/core/internal/node-logger');

const WORKING_DIR = fileURLToPath(new URL('./__fixtures__/two-dev-servers/alpha', import.meta.url));

/** Ref'd timers keep Node alive, so a closed dev server must leave none of its own behind. */
function countRefedTimers(): number {
  return process.getActiveResourcesInfo().filter((resource) => resource === 'Timeout').length;
}

describe('closing a dev server', () => {
  it.each([
    { name: 'right after startup', events: [] },
    { name: 'after the story index was invalidated', events: [STORY_INDEX_INVALIDATED] },
  ])(
    'releases its timers $name',
    async ({ events }) => {
      vi.stubGlobal('FEATURES', {});
      const before = countRefedTimers();
      const host = await buildDevStandalone({
        workingDir: WORKING_DIR,
        configDir: '.storybook',
        port: await getPort(0),
        exactPort: true,
        host: '127.0.0.1',
        ci: true,
        quiet: true,
        open: false,
        versionUpdates: false,
        disableTelemetry: true,
        test: true,
      });
      for (const event of events) {
        // Channel listeners run in registration order, so this one runs after the server's own.
        const delivered = new Promise((resolve) => host.storybook.channel.once(event, resolve));
        host.storybook.channel.emit(event);
        await delivered;
      }
      await host.close();
      vi.unstubAllGlobals();

      await expect.poll(countRefedTimers, { timeout: 3000 }).toBe(before);
    },
    30000
  );
});
