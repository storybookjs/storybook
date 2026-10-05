import type { Options, StoryIndex } from 'storybook/internal/types';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { clearRegistry, getService } from '../../shared/open-service/server.ts';
import type { ModuleGraphService } from '../../shared/open-service/services/module-graph/definition.ts';
import type { ReviewService } from '../../shared/open-service/services/review/definition.ts';
import { clearToolsetRegistry } from '../../shared/open-service/toolset-registry.ts';

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
let servicesHook: () => Promise<void>;
let services: typeof import('./common-preset.ts').services;
let experimental_devServer: typeof import('./common-preset.ts').experimental_devServer;
let applyServicesPresetOnce: typeof import('../utils/apply-services-preset-once.ts').applyServicesPresetOnce;
let OpenServiceDevServerSubscriptionsMissingError: typeof import('../../server-errors.ts').OpenServiceDevServerSubscriptionsMissingError;

beforeEach(async () => {
  // The subscription queue is module state, so each test needs a fresh `common-preset` instance.
  vi.resetModules();
  ({ services, experimental_devServer } = await import('./common-preset.ts'));
  ({ applyServicesPresetOnce } = await import('../utils/apply-services-preset-once.ts'));
  ({ OpenServiceDevServerSubscriptionsMissingError } = await import('../../server-errors.ts'));

  servicesHook = () => services(undefined, options);
  options = {
    channel: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    presets: {
      apply: async (extension: string, config?: unknown) => {
        switch (extension) {
          case 'services':
            return servicesHook();
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
  clearToolsetRegistry();
  vi.stubGlobal('STORYBOOK_SERVICES_LOADED', false);
  vi.stubGlobal('STORYBOOK_SERVICES_PRESET_PROMISE', undefined);
  now = 1_000;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
});

afterEach(() => {
  clearRegistry();
  clearToolsetRegistry();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function setButtonReview() {
  const review = getService<ReviewService>('core/review', { internal: true });
  const moduleGraph = getService<ModuleGraphService>('core/module-graph', { internal: true });
  await review.commands.setReview({
    title: 'Button',
    description: 'Checks the Button.',
    collections: [{ title: 'Button', rationale: 'Changed.', storyIds: ['button--primary'] }],
    changedFiles: [],
  });
  // Past the review's grace window, so a module-graph change marks it stale.
  now = 12_000;
  return { review, moduleGraph };
}

it('marks the review stale on module-graph changes only once experimental_devServer ran', async () => {
  await applyServicesPresetOnce(options.presets);
  const { review, moduleGraph } = await setButtonReview();

  await moduleGraph.commands._applyGraphUpdate({ bumpedStoryFiles: ['./src/Button.stories.tsx'] });
  expect(review.queries.current.get(undefined)?.stale).toBeUndefined();

  await experimental_devServer(undefined as never, options);
  await moduleGraph.commands._applyGraphUpdate({ bumpedStoryFiles: ['./src/Button.stories.tsx'] });
  await vi.waitFor(() => expect(review.queries.current.get(undefined)?.stale).toBe(true));
});

it('applies services itself when experimental_devServer runs first', async () => {
  await experimental_devServer(undefined as never, options);
  const { review, moduleGraph } = await setButtonReview();

  await moduleGraph.commands._applyGraphUpdate({ bumpedStoryFiles: ['./src/Button.stories.tsx'] });
  await vi.waitFor(() => expect(review.queries.current.get(undefined)?.stale).toBe(true));
});

it('waits for services that are still being applied', async () => {
  const applyingServices = applyServicesPresetOnce(options.presets);
  await experimental_devServer(undefined as never, options);
  await applyingServices;
  const { review, moduleGraph } = await setButtonReview();

  await moduleGraph.commands._applyGraphUpdate({ bumpedStoryFiles: ['./src/Button.stories.tsx'] });
  await vi.waitFor(() => expect(review.queries.current.get(undefined)?.stale).toBe(true));
});

it('throws when services completed without queuing the dev-server subscriptions', async () => {
  servicesHook = async () => {};

  await expect(experimental_devServer(undefined as never, options)).rejects.toThrow(
    OpenServiceDevServerSubscriptionsMissingError
  );
});
