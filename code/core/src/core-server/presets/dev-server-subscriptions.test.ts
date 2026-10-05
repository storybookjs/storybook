import type { Options, StoryIndex } from 'storybook/internal/types';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { clearRegistry, getService } from '../../shared/open-service/server.ts';
import type { ModuleGraphService } from '../../shared/open-service/services/module-graph/definition.ts';
import type { ReviewService } from '../../shared/open-service/services/review/definition.ts';
import { experimental_devServer, services } from './common-preset.ts';

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

let now: number;
let options: Options;

beforeEach(() => {
  options = {
    channel: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    presets: {
      apply: async (extension: string, config?: unknown) => {
        switch (extension) {
          case 'features':
            return { changeDetection: true };
          case 'storyIndexGenerator':
            return { getIndex: async () => index };
          default:
            return config;
        }
      },
    },
  } as unknown as Options;
  clearRegistry();
  vi.stubGlobal('STORYBOOK_SERVICES_LOADED', false);
  now = 1_000;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
});

afterEach(() => {
  clearRegistry();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('marks the review stale on module-graph changes only once experimental_devServer ran', async () => {
  await services(undefined, options);
  const review = getService<ReviewService>('core/review', { internal: true });
  const moduleGraph = getService<ModuleGraphService>('core/module-graph', { internal: true });
  await review.commands.setReview({
    title: 'Button',
    description: 'Checks the Button.',
    collections: [{ title: 'Button', rationale: 'Changed.', storyIds: ['button--primary'] }],
    changedFiles: [],
  });

  now = 12_000;
  await moduleGraph.commands._applyGraphUpdate({ bumpedStoryFiles: ['./src/Button.stories.tsx'] });
  expect(review.queries.current.get(undefined)?.stale).toBeUndefined();

  await experimental_devServer(undefined as never, options);
  await moduleGraph.commands._applyGraphUpdate({ bumpedStoryFiles: ['./src/Button.stories.tsx'] });
  await vi.waitFor(() => expect(review.queries.current.get(undefined)?.stale).toBe(true));
});
