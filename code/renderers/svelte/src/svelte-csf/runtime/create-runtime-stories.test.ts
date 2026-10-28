/**
 * @vitest-environment happy-dom
 */

import { logger } from 'storybook/internal/client-logger';
import type { Component } from 'svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createRuntimeStories } from './create-runtime-stories.ts';

vi.mock('storybook/internal/client-logger', { spy: true });

const failedStoriesComponent = (() => {
  throw new Error('failed to mount stories component');
}) as unknown as Component;

describe(createRuntimeStories.name, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Spy without passthrough: the real client logger forwards to `console.error`, which the
    // global test setup treats as an unexpected console call.
    vi.mocked(logger.error).mockImplementation(() => {});
  });

  it('logs a failed mount through the client logger', () => {
    expect(() => createRuntimeStories(failedStoriesComponent, {})).not.toThrow();

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(vi.mocked(logger.error).mock.calls[0][0]).toContain('Error in mounting stories');
    expect(vi.mocked(logger.error).mock.calls[0][1]).toBeInstanceOf(Error);
  });
});
