import type { StoryIndex } from '@storybook/core/internal/types';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { instanceContext } from '../instance/instance-context.ts';
import type { Storybook } from '../instance/types.ts';
import { getInstanceContext, type InstanceContext } from '../shared/instance-context.ts';
import { clearRegistry } from '../shared/open-service/server.ts';
import { clearToolsetRegistry } from '../shared/open-service/toolset-registry.ts';
import { getDevServerSubscriptions } from './dev-server-subscriptions.ts';

const index = { v: 5, entries: {} } as StoryIndex;

let storybook: Storybook;
let started: Array<InstanceContext | undefined>;
let services: typeof import('./preset.ts').services;
let experimental_devServer: typeof import('./preset.ts').experimental_devServer;
let applyServicesPresetOnce: typeof import('./apply-services-preset-once.ts').applyServicesPresetOnce;

beforeEach(async () => {
  // The subscription queue is module state, so each test needs a fresh services preset module.
  vi.resetModules();
  ({ services, experimental_devServer } = await import('./preset.ts'));
  ({ applyServicesPresetOnce } = await import('./apply-services-preset-once.ts'));

  started = [];
  storybook = {
    configDir: process.cwd(),
    channel: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    getIndex: async () => index,
    // Like a built-in, registers its services, then a subscription that must wait for the dev server.
    callHook: async (name: string, value?: unknown) => {
      if (name !== 'core:services:register') {
        return value;
      }
      await services(storybook);
      const context = getInstanceContext();
      getDevServerSubscriptions().push(() => started.push(context));
    },
  } as unknown as Storybook;
  clearRegistry();
});

afterEach(() => {
  clearRegistry();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const createContext = (): InstanceContext => ({
  channel: storybook.channel,
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
async function inInstance(run: (context: InstanceContext) => Promise<void>): Promise<void> {
  const context = createContext();
  try {
    await instanceContext.run(context, () => run(context));
  } finally {
    await disposeContext(context);
  }
}

it('starts subscriptions registered with services only once experimental_devServer ran', () =>
  inInstance(async (context) => {
    await applyServicesPresetOnce(storybook);
    expect(started).toEqual([]);

    await experimental_devServer(undefined as never, storybook);
    expect(started).toEqual([context]);
  }));

it('applies services itself when experimental_devServer runs first', () =>
  inInstance(async (context) => {
    await experimental_devServer(undefined as never, storybook);
    expect(started).toEqual([context]);
  }));

it('waits for services that are still being applied', () =>
  inInstance(async (context) => {
    const applyingServices = applyServicesPresetOnce(storybook);
    await experimental_devServer(undefined as never, storybook);
    await applyingServices;
    expect(started).toEqual([context]);
  }));

it('starts only the owning instance subscriptions and preserves another instance queue', async () => {
  const first = createContext();
  const second = createContext();
  try {
    await instanceContext.run(first, () => applyServicesPresetOnce(storybook));
    await instanceContext.run(second, () => applyServicesPresetOnce(storybook));

    await instanceContext.run(first, () => experimental_devServer(undefined as never, storybook));
    expect(started.map((context) => context === first)).toEqual([true]);

    await instanceContext.run(second, () => experimental_devServer(undefined as never, storybook));
    expect(started.map((context) => context === second)).toEqual([false, true]);
  } finally {
    await disposeContext(first);
    await disposeContext(second);
  }
});
