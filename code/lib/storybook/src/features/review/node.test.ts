import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Storybook } from '@storybook/core';
import { Channel } from '@storybook/core/internal/channels';
import type { ModuleGraphService } from '@storybook/core/internal/services';
import { telemetry } from '@storybook/core/internal/telemetry';
import { REVIEW_EVENTS, type StoryIndex } from '@storybook/core/internal/types';
import { getRegisteredToolsets } from '@storybook/core/open-service';
import { experimental_devServer, services } from '@storybook/core/internal/deep/services/preset';
import {
  clearRegistry,
  getRegisteredServices,
  getService,
} from '@storybook/core/internal/deep/shared/open-service/server';
import type { ReviewService } from '@storybook/core/internal/deep/shared/open-service/services/review/definition';

import { useTestInstance } from '../../../../../core/src/shared/instance-context.test-helpers.ts';
import review from './node.ts';

vi.mock('@storybook/core/internal/telemetry', { spy: true });

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

const buttonReview = {
  title: 'Button',
  description: 'Checks the Button.',
  collections: [{ title: 'Button', rationale: 'Changed.', storyIds: ['button--primary'] }],
  changedFiles: [],
};

/** A Storybook whose hooks run core's services first, then each given addon's handlers. */
function createStorybook(addons: ReturnType<typeof review>[]): Storybook {
  const handlers: Record<string, Array<(...args: unknown[]) => unknown>> = {};
  const storybook = {
    configDir: process.cwd(),
    channel: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    getIndex: async () => index,
    hook: (name: string, handler: (...args: unknown[]) => unknown) => {
      (handlers[name] ??= []).push(handler);
    },
    callHook: async (name: string, value?: unknown) => {
      if (name === 'core:services:register') {
        await services(storybook);
      }
      for (const handler of handlers[name] ?? []) {
        await handler(value);
      }
      return value;
    },
  } as unknown as Storybook;
  for (const addon of addons) {
    void addon.setup(storybook);
  }
  return storybook;
}

/** What one instance exposes for review once its dev server and channel are up. */
async function reviewSurface(addons: ReturnType<typeof review>[]) {
  const storybook = createStorybook(addons);
  const channel = new Channel({});
  await experimental_devServer(undefined as never, storybook);
  await storybook.callHook('server:channel:ready', channel);
  return {
    services: getRegisteredServices()
      .map(({ id }) => id)
      .filter((id) => id === 'core/review'),
    toolsets: getRegisteredToolsets()
      .map(({ id }) => id)
      .filter((id) => id === 'review'),
    channelEvents: channel.eventNames(),
  };
}

describe('review built-in', () => {
  useTestInstance();

  let now: number;
  beforeEach(() => {
    clearRegistry();
    now = 1_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    vi.mocked(telemetry).mockResolvedValue(undefined);
  });

  afterEach(() => {
    clearRegistry();
    vi.restoreAllMocks();
  });

  it.each([
    {
      name: 'present',
      addons: [review()],
      expected: {
        services: ['core/review'],
        toolsets: ['review'],
        channelEvents: [REVIEW_EVENTS.PAGEVIEW],
      },
    },
    { name: 'absent', addons: [], expected: { services: [], toolsets: [], channelEvents: [] } },
  ])(
    'exposes the review service, toolset and telemetry only when $name',
    async ({ addons, expected }) => {
      expect(await reviewSurface(addons)).toEqual(expected);
    }
  );

  it('bundles the manager entry from @storybook/manager', () => {
    expect(review().manager).toMatch(
      /manager\/dist\/shared\/open-service\/services\/review\/manager\.js$/
    );
  });

  it.each([
    { name: 'before the dev server starts', startDevServer: false, expected: undefined },
    { name: 'once the dev server starts', startDevServer: true, expected: true },
  ])(
    'marks the review stale on module-graph changes $name',
    async ({ startDevServer, expected }) => {
      const storybook = createStorybook([review()]);
      await (startDevServer
        ? experimental_devServer(undefined as never, storybook)
        : storybook.callHook('core:services:register', undefined));
      const reviewService = getService<ReviewService>('core/review', { internal: true });
      const moduleGraph = getService<ModuleGraphService>('core/module-graph', { internal: true });
      await reviewService.commands.setReview(buttonReview);
      now = 12_000;

      await moduleGraph.commands._applyGraphUpdate({
        bumpedStoryFiles: ['./src/Button.stories.tsx'],
      });

      await vi.waitFor(() =>
        expect(reviewService.queries.current.get(undefined)?.stale).toBe(expected)
      );
    }
  );

  it.each([
    { page: 'summary', reviewCreatedAt: 1700000000000 },
    { page: 'detail', reviewCreatedAt: 1700000000000 },
  ])('records a $page review page view', async (payload) => {
    const channel = new Channel({});
    await createStorybook([review()]).callHook('server:channel:ready', channel);

    channel.emit(REVIEW_EVENTS.PAGEVIEW, payload);

    expect(telemetry).toHaveBeenCalledWith('review', {
      action: 'pageview',
      source: 'mcp-review',
      ...payload,
    });
  });
});
