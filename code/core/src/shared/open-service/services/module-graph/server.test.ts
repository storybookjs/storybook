import { afterEach, describe, expect, it, vi } from 'vitest';

import { STORY_INDEX_INVALIDATED } from 'storybook/internal/core-events';

import { clearRegistry } from '../../server.ts';
import { provideChangeDetectionAdapter } from './adapter-bridge.ts';
import { createMockAdapter } from './module-graph.test-helpers.ts';
import { registerModuleGraphService } from './server.ts';

afterEach(() => {
  clearRegistry();
});

describe('module-graph open service', () => {
  it('registers queries and mirrors a built graph after the adapter is provided', async () => {
    const channel = { on: vi.fn(() => () => undefined), emit: vi.fn() };
    const { adapter } = createMockAdapter({ resolveConfig: { projectRoot: '/repo' } });

    const runtime = registerModuleGraphService({
      channel: channel as never,
      storyIndexGeneratorPromise: Promise.resolve({
        getIndex: vi.fn().mockResolvedValue({ v: 5, entries: {} }),
      } as never),
      workingDir: '/repo',
    });

    expect(channel.on).toHaveBeenCalledWith(STORY_INDEX_INVALIDATED, expect.any(Function));
    expect(runtime.queries.getReady(undefined)).toBe(false);

    provideChangeDetectionAdapter(adapter);

    await vi.waitFor(() => {
      expect(runtime.queries.getReady(undefined)).toBe(true);
    });
  });
});
