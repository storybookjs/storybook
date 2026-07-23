import type { StoryIndex } from 'storybook/internal/types';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearRegistry } from '../../server.ts';
import { invokeApi } from '../../../public-api/index.ts';
import { createReviewApi } from './api.ts';
import { registerReviewService } from './server.ts';

const index = {
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
  },
} as StoryIndex;

const input = {
  title: 'Button tweaks',
  description: 'Check primary',
  collections: [
    {
      title: 'Primary',
      rationale: 'edited',
      storyIds: ['button--primary'],
    },
  ],
  changedFiles: ['src/Button.tsx'],
};

describe('review API', () => {
  beforeEach(() => {
    clearRegistry();
  });

  afterEach(() => {
    clearRegistry();
    vi.restoreAllMocks();
  });

  it('validates story ids before setting review state', async () => {
    const service = registerReviewService();
    const setReview = vi.spyOn(service.commands, 'setReview');
    const api = createReviewApi({
      getIndex: async () => index,
      getOrigin: () => 'http://localhost:6006',
    });

    await expect(
      invokeApi(api, 'create', {
        ...input,
        collections: [{ ...input.collections[0], storyIds: ['missing--story'] }],
      })
    ).rejects.toThrow(/1 story ID is not in the live Storybook index/);
    expect(setReview).not.toHaveBeenCalled();
  });

  it('rejects with a missing-origin error when no server origin is configured', async () => {
    const service = registerReviewService();
    const setReview = vi.spyOn(service.commands, 'setReview');
    const api = createReviewApi({
      getIndex: async () => index,
      getOrigin: () => '',
    });

    await expect(invokeApi(api, 'create', input)).rejects.toThrow(
      /requires a Storybook server origin/
    );
    expect(setReview).not.toHaveBeenCalled();
  });

  it('sets review state and returns Markdown by default', async () => {
    const service = registerReviewService();
    const setReview = vi.spyOn(service.commands, 'setReview');
    const api = createReviewApi({
      getIndex: async () => index,
      getOrigin: () => 'http://localhost:6006/',
    });

    await expect(invokeApi(api, 'create', input)).resolves.toBe(
      'Review created: http://localhost:6006/?path=/review/'
    );
    expect(setReview).toHaveBeenCalledWith(input);
  });

  it('adds the user-facing instruction only for the MCP Markdown response', async () => {
    registerReviewService();
    const api = createReviewApi({
      getIndex: async () => index,
      getOrigin: () => 'http://localhost:6006',
    });

    const cliResult = await invokeApi(api, 'create', input, { consumer: 'cli' });
    const mcpResult = await invokeApi(api, 'create', input, { consumer: 'mcp' });

    expect(mcpResult).toBe(
      `${cliResult}\n\nShow this review URL to the user in your final response.`
    );
  });

  it('returns structured data with json true', async () => {
    registerReviewService();
    const api = createReviewApi({
      getIndex: async () => index,
      getOrigin: () => 'http://localhost:6006',
    });

    await expect(invokeApi(api, 'create', { ...input, json: true })).resolves.toEqual({
      reviewUrl: 'http://localhost:6006/?path=/review/',
    });
  });
});
