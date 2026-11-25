import { Channel } from 'storybook/internal/channels';
import { UPDATE_STORY_ARGS } from 'storybook/internal/core-events';
import { addons } from 'storybook/internal/preview-api';
import { cleanup } from '@testing-library/svelte';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { composeStories } from '../../portable-stories.ts';
import { snapshotArg, syncStoryArgs } from '../../svelte-csf/runtime/sync-story-args.ts';
import * as ReactiveArgsStories from './reactive-args.stories.svelte';
import * as ReactiveListArgsStories from './reactive-list-args.stories.svelte';

vi.mock('storybook/internal/preview-api', { spy: true });

const { Reactive, Extended, Overridden } = composeStories(ReactiveArgsStories as never) as Record<
  string,
  any
>;

const { InPlace } = composeStories(ReactiveListArgsStories as never) as Record<string, any>;

let updates: unknown[];

beforeEach(() => {
  const channel = new Channel({});
  vi.mocked(addons.getChannel).mockReturnValue(channel);
  updates = [];
  channel.on(UPDATE_STORY_ARGS, (payload) => updates.push(payload));
});

afterEach(() => {
  cleanup();
});

it('sends the args that change after extraction to Storybook', async () => {
  await Reactive.run();

  expect(updates).toEqual([
    { storyId: Reactive.id, updatedArgs: { text: 'changed' } },
    { storyId: Reactive.id, updatedArgs: { text: 'initial' } },
  ]);
});

it('sends the args that a story inherits from the story it extends', async () => {
  await Extended.run();

  expect(updates).toEqual([
    { storyId: Extended.id, updatedArgs: { text: 'changed' } },
    { storyId: Extended.id, updatedArgs: { text: 'initial' } },
  ]);
});

it('does not send an inherited arg that the story sets itself', async () => {
  await Overridden.run();

  expect(updates).toEqual([]);
});

it('does not send a value again when the story remounts', () => {
  const argSources = { text: { exportName: 'Reactive', value: 'initial' } };
  const sync = () =>
    syncStoryArgs({
      exportName: 'Reactive',
      storyArgs: { text: 'changed' },
      argSources,
      storyId: 'remount',
    });

  sync();
  sync();

  expect(updates).toEqual([{ storyId: 'remount', updatedArgs: { text: 'changed' } }]);
});

it('sends a `$state` array that changes in place', async () => {
  await InPlace.run();

  expect(updates).toEqual([{ storyId: InPlace.id, updatedArgs: { items: ['a', 'b'] } }]);
});

it('does not send an object arg that is a new object with the same content', () => {
  syncStoryArgs({
    exportName: 'Static',
    storyArgs: { items: { a: 1 } },
    argSources: { items: { exportName: 'Static', value: { a: 1 } } },
    storyId: 'static-object',
  });

  expect(updates).toEqual([]);
});

it('sends state that a hot update of the stories file sets back', () => {
  const sync = (
    argSources: Record<string, { exportName: string; value: unknown }>,
    count: number
  ) => syncStoryArgs({ exportName: 'Hmr', storyArgs: { count }, argSources, storyId: 'hmr' });

  sync({ count: { exportName: 'Hmr', value: 0 } }, 5);
  // The hot update runs the module script again, so the extraction and the state are 0 again
  sync({ count: { exportName: 'Hmr', value: 0 } }, 0);

  expect(updates).toEqual([
    { storyId: 'hmr', updatedArgs: { count: 5 } },
    { storyId: 'hmr', updatedArgs: { count: 0 } },
  ]);
});

it('compares an arg with a cycle without a stack overflow', () => {
  const node: Record<string, unknown> = { name: 'root' };
  node.self = node;
  const same: Record<string, unknown> = { name: 'root' };
  same.self = same;

  syncStoryArgs({
    exportName: 'Tree',
    storyArgs: { node: same },
    argSources: { node: { exportName: 'Tree', value: snapshotArg(node) } },
    storyId: 'cyclic',
  });

  expect(updates).toEqual([]);
});
