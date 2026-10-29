import { describe, expect, it, vi } from 'vitest';

import { Channel } from '@storybook/core/internal/channels';
import {
  AI_SETUP_ANALYTICS_REQUEST,
  GHOST_STORIES_REQUEST,
  OPEN_IN_EDITOR_REQUEST,
  REQUEST_WHATS_NEW_DATA,
  SAVE_STORY_REQUEST,
  SET_WHATS_NEW_CACHE,
  TELEMETRY_ERROR,
  TOGGLE_WHATS_NEW_NOTIFICATIONS,
} from '@storybook/core/internal/core-events';

import { experimental_serverChannel } from '../storybook/server/presets/common-defaults.ts';
import { createChecklistServerStore, initializeChecklist } from './checklist/checklist.ts';
import checklist from './checklist/node.ts';
import controls from './controls/node.ts';
import openInEditor from './open-in-editor/node.ts';
import whatsNew from './whats-new/node.ts';

vi.mock('./checklist/checklist.ts', () => ({
  createChecklistServerStore: vi.fn(() => ({ __dispose: vi.fn() })),
  initializeChecklist: vi.fn(),
}));

/** Events the features below answer; the host itself must answer none of them. */
const FEATURE_EVENTS: string[] = [
  SAVE_STORY_REQUEST,
  REQUEST_WHATS_NEW_DATA,
  SET_WHATS_NEW_CACHE,
  TOGGLE_WHATS_NEW_NOTIFICATIONS,
  OPEN_IN_EDITOR_REQUEST,
  GHOST_STORIES_REQUEST,
  AI_SETUP_ANALYTICS_REQUEST,
];

/** Set an addon up against a recorder, then run its channel handler on a fresh channel. */
async function listenersOf(addon: { setup: (storybook: never) => unknown }): Promise<string[]> {
  const handlers: Record<string, (...args: unknown[]) => unknown> = {};
  await addon.setup({
    configDir: '/project/.storybook',
    workingDir: '/project',
    getStoryIndexGenerator: vi.fn(),
    hook: (name: string, handler: (...args: unknown[]) => unknown) => {
      handlers[name] = handler;
    },
  } as never);
  expect(Object.keys(handlers)).toEqual(['server:channel:ready']);
  const channel = new Channel({});
  await handlers['server:channel:ready'](channel, { configDir: '/project/.storybook' });
  return channel.eventNames();
}

describe('server-only built-ins', () => {
  it.each([
    { name: 'controls', addon: controls(), expected: [SAVE_STORY_REQUEST] },
    {
      name: 'whats-new',
      addon: whatsNew(),
      expected: [SET_WHATS_NEW_CACHE, REQUEST_WHATS_NEW_DATA, TOGGLE_WHATS_NEW_NOTIFICATIONS],
    },
    { name: 'open-in-editor', addon: openInEditor(), expected: [OPEN_IN_EDITOR_REQUEST] },
  ])('$name answers its events once present', async ({ addon, expected }) => {
    expect(await listenersOf(addon)).toEqual(expected);
  });

  it('checklist owns its store on the instance channel until close', async () => {
    const handlers: Record<string, (...args: unknown[]) => unknown> = {};
    const instanceChannel = new Channel({});
    await checklist().setup({
      attached: false,
      channel: instanceChannel,
      configDir: '/project/.storybook',
      getStoryIndexGenerator: vi.fn(),
      hook: (name: string, handler: (...args: unknown[]) => unknown) => {
        handlers[name] = handler;
      },
    } as never);
    const store = vi.mocked(createChecklistServerStore).mock.results[0].value;
    expect(createChecklistServerStore).toHaveBeenCalledWith(instanceChannel);

    await handlers['server:channel:ready'](instanceChannel);
    expect(initializeChecklist).toHaveBeenCalledWith(
      store,
      instanceChannel,
      expect.any(Function),
      '/project/.storybook'
    );

    await handlers['core:instance:close']();
    expect(store.__dispose).toHaveBeenCalledOnce();
  });

  it('leaves feature events unanswered when the built-ins are absent', async () => {
    const channel = new Channel({});
    await experimental_serverChannel(channel, {} as never);
    expect(channel.eventNames()).toContain(TELEMETRY_ERROR);
    expect(channel.eventNames().filter((name) => FEATURE_EVENTS.includes(name))).toEqual([]);
  });
});
