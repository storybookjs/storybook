import { beforeEach, describe, expect, it } from 'vitest';

import { clearToolsetRegistry, getToolset } from 'storybook/open-service';
import type { Options } from 'storybook/internal/types';

import { services } from './preset.ts';

const options = {
  channel: { on: () => {}, off: () => {}, emit: () => {} },
  presets: {
    apply: async (key: string, fallback?: unknown) =>
      key === 'storyIndexGenerator' ? { getIndex: async () => ({ v: 5, entries: {} }) } : fallback,
  },
} as unknown as Options;

describe('services preset hook', () => {
  beforeEach(() => {
    clearToolsetRegistry();
  });

  // Consumers resolve the `test` toolset for its descriptions and schemas alone, without a dev
  // server: `storybook ai` metadata generation applies `services` but never starts one, and a
  // non-Vite dev server returns from `experimental_serverChannel` before it could register. Both
  // used to hit an unregistered toolset and fail hard.
  it('registers the test toolset without a server channel', async () => {
    await services(undefined, options);

    expect(getToolset('test').methods.run.description).toBeDefined();
  });
});
