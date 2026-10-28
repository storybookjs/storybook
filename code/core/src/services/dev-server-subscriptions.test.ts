import type { Options, StoryIndex } from '@storybook/core/internal/types';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { instanceContext } from '../instance/instance-context.ts';
import type { InstanceContext } from '../shared/instance-context.ts';
import { clearRegistry, getService } from '../shared/open-service/server.ts';
import type { ModuleGraphService } from '../shared/open-service/services/module-graph/definition.ts';
import type { ReviewService } from '../shared/open-service/services/review/definition.ts';
import { clearToolsetRegistry } from '../shared/open-service/toolset-registry.ts';
import { createUniversalStoreRealm } from '../shared/universal-store/realm.ts';

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
let services: typeof import('./preset.ts').services;
let experimental_devServer: typeof import('./preset.ts').experimental_devServer;
let applyServicesPresetOnce: typeof import('./apply-services-preset-once.ts').applyServicesPresetOnce;

beforeEach(async () => {
  // The subscription queue is module state, so each test needs a fresh services preset module.
  vi.resetModules();
  ({ services, experimental_devServer } = await import('./preset.ts'));
  ({ applyServicesPresetOnce } = await import('./apply-services-preset-once.ts'));

  options = {
    channel: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    presets: {
      apply: async (extension: string, config?: unknown) => {
        switch (extension) {
          case 'services':
            return services(undefined, options);
          case 'features':
            return {};
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
  now = 1_000;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
});

afterEach(() => {
  clearRegistry();
  clearToolsetRegistry();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const createContext = (): InstanceContext => ({
  channel: options.channel,
  universalStoreRealm: createUniversalStoreRealm({
    channel: options.channel,
    environment: 'SERVER',
  }),
  workingDir: process.cwd(),
  state: new Map(),
  cleanups: new Set(),
  getStoryIndexGenerator: vi.fn(),
});

async function disposeContext(context: InstanceContext): Promise<void> {
  await instanceContext.run(context, async () => {
    await Promise.all([...context.cleanups].map((cleanup) => cleanup()));
    clearRegistry();
    clearToolsetRegistry();
  });
}

/** Services only register inside an instance, so each test runs in its own context. */
async function inInstance(run: () => Promise<void>): Promise<void> {
  const context = createContext();
  try {
    await instanceContext.run(context, run);
  } finally {
    await disposeContext(context);
  }
}

async function setButtonReview() {
  const review = getService<ReviewService>('core/review', { internal: true });
  const moduleGraph = getService<ModuleGraphService>('core/module-graph', { internal: true });
  await review.commands.setReview({
    title: 'Button',
    description: 'Checks the Button.',
    collections: [{ title: 'Button', rationale: 'Changed.', storyIds: ['button--primary'] }],
    changedFiles: [],
  });
  // Dates the next module-graph change after the review was published.
  now = 12_000;
  return { review, moduleGraph };
}

it('marks the review stale for changes since publishing only once experimental_devServer ran', () =>
  inInstance(async () => {
    await applyServicesPresetOnce(options.presets);
    const { review, moduleGraph } = await setButtonReview();

    await moduleGraph.commands._applyGraphUpdate({
      bumpedStoryFiles: ['./src/Button.stories.tsx'],
    });
    expect(review.queries.current.get(undefined)?.stale).toBeUndefined();

    await experimental_devServer(undefined as never, options);
    await vi.waitFor(() => expect(review.queries.current.get(undefined)?.stale).toBe(true));
  }));

it('applies services itself when experimental_devServer runs first', () =>
  inInstance(async () => {
    await experimental_devServer(undefined as never, options);
    const { review, moduleGraph } = await setButtonReview();

    await moduleGraph.commands._applyGraphUpdate({
      bumpedStoryFiles: ['./src/Button.stories.tsx'],
    });
    await vi.waitFor(() => expect(review.queries.current.get(undefined)?.stale).toBe(true));
  }));

it('waits for services that are still being applied', () =>
  inInstance(async () => {
    const applyingServices = applyServicesPresetOnce(options.presets);
    await experimental_devServer(undefined as never, options);
    await applyingServices;
    const { review, moduleGraph } = await setButtonReview();

    await moduleGraph.commands._applyGraphUpdate({
      bumpedStoryFiles: ['./src/Button.stories.tsx'],
    });
    await vi.waitFor(() => expect(review.queries.current.get(undefined)?.stale).toBe(true));
  }));

it('starts only the owning instance subscriptions and preserves another instance queue', async () => {
  const first = createContext();
  const second = createContext();
  try {
    await instanceContext.run(first, () => applyServicesPresetOnce(options.presets));
    await instanceContext.run(second, () => applyServicesPresetOnce(options.presets));
    const firstServices = await instanceContext.run(first, setButtonReview);
    const secondServices = await instanceContext.run(second, setButtonReview);
    now = 24_000;

    await instanceContext.run(first, () => experimental_devServer(undefined as never, options));
    await firstServices.moduleGraph.commands._applyGraphUpdate({
      bumpedStoryFiles: ['./src/Button.stories.tsx'],
    });
    await secondServices.moduleGraph.commands._applyGraphUpdate({
      bumpedStoryFiles: ['./src/Button.stories.tsx'],
    });
    await vi.waitFor(() =>
      expect(firstServices.review.queries.current.get(undefined)?.stale).toBe(true)
    );
    expect(secondServices.review.queries.current.get(undefined)?.stale).toBeUndefined();

    await instanceContext.run(second, () => experimental_devServer(undefined as never, options));
    await vi.waitFor(() =>
      expect(secondServices.review.queries.current.get(undefined)?.stale).toBe(true)
    );
  } finally {
    await disposeContext(first);
    await disposeContext(second);
  }
});
