import { afterEach, expect, it, vi } from 'vitest';

import { Channel } from '@storybook/core/internal/channels';
import type { Storybook } from 'storybook/internal/instance';

import {
  registerInstanceContext,
  runWithStorybook,
} from '@storybook/core/internal/deep/instance/instance-context';
import { getWsToken } from './wsToken.ts';

afterEach(() => vi.unstubAllGlobals());

it('keeps tokens stable within each instance and distinct from the legacy token', async () => {
  vi.stubGlobal('STORYBOOK_WEBSOCKET_TOKEN', undefined);
  const legacy = getWsToken();
  const instances = [{}, {}] as Storybook[];
  for (const instance of instances) {
    const channel = new Channel({});
    registerInstanceContext(instance, {
      storybook: instance,
      channel,
      workingDir: process.cwd(),
      state: new Map(),
      cleanups: new Set(),
      getStoryIndexGenerator: vi.fn(),
    });
  }
  const tokens = await Promise.all(
    instances.map((instance) =>
      runWithStorybook(instance, async () => {
        const token = getWsToken();
        await Promise.resolve();
        expect(getWsToken()).toBe(token);
        return token;
      })
    )
  );
  expect(new Set([legacy, ...tokens]).size).toBe(3);
  expect(getWsToken()).toBe(legacy);
  expect(globalThis.STORYBOOK_WEBSOCKET_TOKEN).toBe(legacy);
});
