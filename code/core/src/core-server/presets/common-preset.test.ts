import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Options, StoryIndex } from 'storybook/internal/types';

import { createTestChannel, installTestChannel } from '../../channels/test-channel.ts';
import { resetChangeDetectionAdapterForTests } from '../../shared/open-service/services/module-graph/server.ts';
import type { ReviewService } from '../../shared/open-service/services/review/definition.ts';
import { clearRegistry, getService } from '../../shared/open-service/server.ts';
import { clearToolsetRegistry } from '../../shared/open-service/toolset-registry.ts';
import { services } from './common-preset.ts';

const storyIndex: StoryIndex = { v: 5, entries: {} };
const getIndex = vi.fn();

function createOptions() {
  const appliedExtensions: string[] = [];
  const channel = createTestChannel();

  const options = {
    channel,
    ignorePreview: true,
    presets: {
      apply: async (extension: string, config?: unknown) => {
        appliedExtensions.push(extension);
        switch (extension) {
          case 'features':
            return { changeDetection: true };
          case 'storyIndexGenerator':
            return { getIndex };
          default:
            return config;
        }
      },
    },
  } as unknown as Options;

  return { options, channel, appliedExtensions, getIndex };
}

const countApplied = (appliedExtensions: string[]) =>
  appliedExtensions.filter((extension) => extension === 'storyIndexGenerator').length;

describe('services preset hook', () => {
  beforeEach(() => {
    vi.stubGlobal('STORYBOOK_SERVICES_LOADED', false);
    vi.mocked(getIndex).mockReset();
    vi.mocked(getIndex).mockResolvedValue(storyIndex);
  });

  afterEach(() => {
    clearRegistry();
    clearToolsetRegistry();
    resetChangeDetectionAdapterForTests();
    installTestChannel(null);
    vi.unstubAllGlobals();
  });

  it('registers without building the story index', async () => {
    const { options, channel, appliedExtensions, getIndex } = createOptions();
    installTestChannel(channel);

    await services(undefined, options);

    expect(appliedExtensions).not.toContain('storyIndexGenerator');
    expect(getIndex).not.toHaveBeenCalled();
  });

  it('resolves the story index generator once, on first read', async () => {
    const { options, channel, appliedExtensions, getIndex } = createOptions();
    installTestChannel(channel);

    await services(undefined, options);

    const review = getService<ReviewService>('core/review', { internal: true });
    await review.commands.setReview({ title: 'a', description: 'b', collections: [] });
    await review.commands.setReview({ title: 'c', description: 'd', collections: [] });

    expect(countApplied(appliedExtensions)).toBe(1);
    expect(getIndex).toHaveBeenCalledTimes(2);
  });
});
