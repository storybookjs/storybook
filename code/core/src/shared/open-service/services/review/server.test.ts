import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { StoryIndex } from 'storybook/internal/types';

import { clearRegistry } from '../../server.ts';
import { REVIEW_EVENTS } from '../../../review/events.ts';
import { registerReviewService } from './server.ts';

const index: StoryIndex = {
  v: 5,
  entries: {
    'button--primary': {
      type: 'story',
      subtype: 'story',
      id: 'button--primary',
      name: 'Primary',
      title: 'Button',
      importPath: './src/Button.stories.tsx',
      tags: ['story'],
    },
    'button--secondary': {
      type: 'story',
      subtype: 'story',
      id: 'button--secondary',
      name: 'Secondary',
      title: 'Button',
      importPath: './src/Button.stories.tsx',
      tags: ['story'],
    },
  },
};

describe('registerReviewService', () => {
  beforeEach(() => {
    clearRegistry();
  });

  it('throws when collections reference unknown story ids', async () => {
    const channel = { emit: vi.fn() };
    const service = registerReviewService({
      channel,
      getIndex: async () => index,
      getOrigin: () => 'http://localhost:6006',
    });

    await expect(
      service.commands.create({
        title: 'Review',
        description: 'desc',
        collections: [
          {
            title: 'Broken',
            rationale: 'why',
            storyIds: ['button--primary', 'missing--story', 'also-missing'],
          },
        ],
        changedFiles: [],
      })
    ).rejects.toThrow(/2 story IDs are not in the live Storybook index/);

    expect(channel.emit).not.toHaveBeenCalled();
  });

  it('emits PUSH_REVIEW and returns the review URL', async () => {
    const channel = { emit: vi.fn() };
    const input = {
      title: 'Button tweaks',
      description: 'Check primary',
      collections: [
        {
          title: 'Primary',
          rationale: 'edited',
          storyIds: ['button--primary', 'button--primary', 'button--secondary'],
        },
      ],
      changedFiles: ['src/Button.tsx'],
    };

    const service = registerReviewService({
      channel,
      getIndex: async () => index,
      getOrigin: () => 'http://localhost:6006/',
    });

    const result = await service.commands.create(input);

    expect(channel.emit).toHaveBeenCalledWith(REVIEW_EVENTS.PUSH_REVIEW, input);
    expect(result).toEqual({
      reviewUrl: 'http://localhost:6006/?path=/review/',
    });
  });
});
