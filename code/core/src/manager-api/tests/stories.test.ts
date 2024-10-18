import type { Mocked } from 'vitest';
import { describe, expect, it, vi } from 'vitest';

import type { API_StoryEntry } from '@storybook/core/types';
import { global } from '@storybook/global';

import {
  CONFIG_ERROR,
  CURRENT_STORY_WAS_SET,
  DOCS_PREPARED,
  RESET_STORY_ARGS,
  SET_INDEX,
  SET_STORIES,
  STORY_ARGS_UPDATED,
  STORY_INDEX_INVALIDATED,
  STORY_MISSING,
  STORY_PREPARED,
  STORY_SPECIFIED,
  UPDATE_STORY_ARGS,
} from '@storybook/core/core-events';

import { EventEmitter } from 'events';

import { getEventMetadata as getEventMetadataOriginal } from '../lib/events';
import type { ModuleArgs } from '../lib/types';
import { init as initStories } from '../modules/stories';
import type { API, State } from '../root';
import type Store from '../store';
import { docsEntries, mockEntries, navigationEntries, preparedEntries } from './mockStoriesEntries';

const mockGetEntries = vi.fn();
const fetch = vi.mocked(global.fetch);
const getEventMetadata = vi.mocked(getEventMetadataOriginal);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

vi.mock('../lib/events', () => ({
  getEventMetadata: vi.fn(() => ({ sourceType: 'local' })),
}));
vi.mock('@storybook/global', () => ({
  global: {
    ...globalThis,
    fetch: vi.fn(() => ({ json: () => ({ v: 5, entries: mockGetEntries() }) })),
    CONFIG_TYPE: 'DEVELOPMENT',
  },
}));

function createMockStore(initialState: Partial<State> = {}) {
  let state = initialState;
  return {
    getState: vi.fn(() => state),
    setState: vi.fn((s: typeof state) => {
      state = { ...state, ...s };
      return Promise.resolve(state);
    }),
  } as any as Store;
}
function createMockProvider() {
  return {
    getConfig: vi.fn().mockReturnValue({}),
    channel: new EventEmitter(),
  };
}
function createMockModuleArgs({
  fullAPI = {},
  initialState = {},
}: {
  fullAPI?: Partial<Mocked<API>>;
  initialState?: Partial<State>;
}) {
  const navigate = vi.fn();
  const store = createMockStore({ filters: {}, status: {}, ...initialState });
  const provider = createMockProvider();

  return { navigate, store, provider, fullAPI: { ...fullAPI, getRefs: () => ({}) } };
}

describe('stories API', () => {
  it('sets a sensible initialState', () => {
    const moduleArgs = createMockModuleArgs({});
    const { state } = initStories({
      ...(moduleArgs as unknown as ModuleArgs),
      storyId: 'id',
      viewMode: 'story',
    });

    expect(state).toEqual(
      expect.objectContaining({
        previewInitialized: false,
        storyId: 'id',
        viewMode: 'story',
        hasCalledSetOptions: false,
      })
    );
  });

  describe('setIndex', () => {
    it('sets the initial set of stories in the stories hash', async () => {
      const moduleArgs = createMockModuleArgs({});
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { store } = moduleArgs;
      api.setIndex({ v: 5, entries: mockEntries });
      const { index } = store.getState();
      // We need exact key ordering, even if in theory JS doesn't guarantee it
      expect(Object.keys(index!)).toEqual([
        'component-a',
        'component-a--docs',
        'component-a--story-1',
        'component-a--story-2',
        'component-b',
        'component-b--story-3',
      ]);
      expect(index!['component-a']).toMatchObject({
        type: 'component',
        id: 'component-a',
        children: ['component-a--docs', 'component-a--story-1', 'component-a--story-2'],
      });
      expect(index!['component-a--docs']).toMatchObject({
        type: 'docs',
        id: 'component-a--docs',
        parent: 'component-a',
        title: 'Component A',
        name: 'Docs',
        storiesImports: [],
        prepared: false,
      });
      expect(index!['component-a--story-1']).toMatchObject({
        type: 'story',
        id: 'component-a--story-1',
        parent: 'component-a',
        title: 'Component A',
        name: 'Story 1',
        prepared: false,
      });
      expect(
        (index!['component-a--story-1'] as API_StoryEntry as API_StoryEntry).args
      ).toBeUndefined();
    });
    it('trims whitespace of group/component names (which originate from the kind)', () => {
      const moduleArgs = createMockModuleArgs({});
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { store } = moduleArgs;
      api.setIndex({
        v: 5,
        entries: {
          'design-system-some-component--my-story': {
            type: 'story',
            id: 'design-system-some-component--my-story',
            title: '  Design System  /  Some Component  ', // note the leading/trailing whitespace around each part of the path
            name: '  My Story  ', // we only trim the path, so this will be kept as-is (it may intentionally have whitespace)
            importPath: './path/to/some-component.ts',
          },
        },
      });
      const { index } = store.getState();
      // We need exact key ordering, even if in theory JS doesn't guarantee it
      expect(Object.keys(index!)).toEqual([
        'design-system',
        'design-system-some-component',
        'design-system-some-component--my-story',
      ]);
      expect(index!['design-system']).toMatchObject({
        type: 'root',
        name: 'Design System', // root name originates from `kind`, so it gets trimmed
      });
      expect(index!['design-system-some-component']).toMatchObject({
        type: 'component',
        name: 'Some Component', // component name originates from `kind`, so it gets trimmed
      });
      expect(index!['design-system-some-component--my-story']).toMatchObject({
        type: 'story',
        title: '  Design System  /  Some Component  ', // title is kept as-is, because it may be used as identifier
        name: '  My Story  ', // story name is kept as-is, because it's set directly on the story
      });
    });
    it('moves rootless stories to the front of the list', async () => {
      const moduleArgs = createMockModuleArgs({});
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { store } = moduleArgs;
      api.setIndex({
        v: 5,
        entries: {
          'root-first--story-1': {
            type: 'story',
            id: 'root-first--story-1',
            title: 'Root/First',
            name: 'Story 1',
            importPath: './path/to/root/first.ts',
          },
          ...mockEntries,
        },
      });
      const { index } = store.getState();
      // We need exact key ordering, even if in theory JS doesn't guarantee it
      expect(Object.keys(index!)).toEqual([
        'component-a',
        'component-a--docs',
        'component-a--story-1',
        'component-a--story-2',
        'component-b',
        'component-b--story-3',
        'root',
        'root-first',
        'root-first--story-1',
      ]);
      expect(index!.root).toMatchObject({
        type: 'root',
        id: 'root',
        children: ['root-first'],
      });
    });
    it('sets roots when showRoots = true', () => {
      const moduleArgs = createMockModuleArgs({});
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { store, provider } = moduleArgs;
      provider.getConfig.mockReturnValue({ sidebar: { showRoots: true } });
      api.setIndex({
        v: 5,
        entries: {
          'a-b--1': {
            type: 'story',
            id: 'a-b--1',
            title: 'a/b',
            name: '1',
            importPath: './a/b.ts',
          },
        },
      });
      const { index } = store.getState();
      // We need exact key ordering, even if in theory JS doesn't guarantee it
      expect(Object.keys(index!)).toEqual(['a', 'a-b', 'a-b--1']);
      expect(index!.a).toMatchObject({
        type: 'root',
        id: 'a',
        children: ['a-b'],
      });
      expect(index!['a-b']).toMatchObject({
        type: 'component',
        id: 'a-b',
        parent: 'a',
        children: ['a-b--1'],
      });
      expect(index!['a-b--1']).toMatchObject({
        type: 'story',
        id: 'a-b--1',
        parent: 'a-b',
        name: '1',
        title: 'a/b',
      });
    });
    it('does not put bare stories into a root when showRoots = true', () => {
      const moduleArgs = createMockModuleArgs({});
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { store, provider } = moduleArgs;
      provider.getConfig.mockReturnValue({ sidebar: { showRoots: true } });
      api.setIndex({
        v: 5,
        entries: {
          'a--1': {
            type: 'story',
            id: 'a--1',
            title: 'a',
            name: '1',
            importPath: './a.ts',
          },
        },
      });
      const { index } = store.getState();
      // We need exact key ordering, even if in theory JS doesn't guarantee it
      expect(Object.keys(index!)).toEqual(['a', 'a--1']);
      expect(index!.a).toMatchObject({
        type: 'component',
        id: 'a',
        children: ['a--1'],
      });
      expect(index!['a--1']).toMatchObject({
        type: 'story',
        id: 'a--1',
        parent: 'a',
        title: 'a',
        name: '1',
      });
    });
    it('intersects story/docs tags to compute tags for component entries', () => {
      const moduleArgs = createMockModuleArgs({});
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { store } = moduleArgs;
      api.setIndex({
        v: 5,
        entries: {
          'a--1': {
            type: 'story',
            id: 'a--1',
            title: 'a',
            name: '1',
            tags: ['shared', 'one-specific'],
            importPath: './a.ts',
          },
          'a--2': {
            type: 'story',
            id: 'a--2',
            title: 'a',
            name: '2',
            tags: ['shared', 'two-specific'],
            importPath: './a.ts',
          },
        },
      });
      const { index } = store.getState();
      // We need exact key ordering, even if in theory JS doesn't guarantee it
      expect(Object.keys(index!)).toEqual(['a', 'a--1', 'a--2']);
      expect(index!.a).toMatchObject({
        type: 'component',
        id: 'a',
        tags: ['shared'],
        children: ['a--1', 'a--2'],
      });
      expect(index!['a--1']).toMatchObject({
        type: 'story',
        id: 'a--1',
        parent: 'a',
        title: 'a',
        name: '1',
        tags: ['shared', 'one-specific'],
      });
      expect(index!['a--2']).toMatchObject({
        type: 'story',
        id: 'a--2',
        parent: 'a',
        title: 'a',
        name: '2',
        tags: ['shared', 'two-specific'],
      });
    });
    // Stories can get out of order for a few reasons -- see reproductions on
    //   https://github.com/storybookjs/storybook/issues/5518
    it('does the right thing for out of order stories', async () => {
      const moduleArgs = createMockModuleArgs({});
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { store, provider } = moduleArgs;
      provider.getConfig.mockReturnValue({ sidebar: { showRoots: true } });
      api.setIndex({
        v: 5,
        entries: {
          'a--1': { type: 'story', title: 'a', name: '1', id: 'a--1', importPath: './a.ts' },
          'b--1': { type: 'story', title: 'b', name: '1', id: 'b--1', importPath: './b.ts' },
          'a--2': { type: 'story', title: 'a', name: '2', id: 'a--2', importPath: './a.ts' },
        },
      });
      const { index } = store.getState();
      // We need exact key ordering, even if in theory JS doesn't guarantee it
      expect(Object.keys(index!)).toEqual(['a', 'a--1', 'a--2', 'b', 'b--1']);
      expect(index!.a).toMatchObject({
        type: 'component',
        id: 'a',
        children: ['a--1', 'a--2'],
      });
      expect(index!.b).toMatchObject({
        type: 'component',
        id: 'b',
        children: ['b--1'],
      });
    });
    // Entries on the SET_STORIES event will be prepared
    it('handles properly prepared stories', async () => {
      const moduleArgs = createMockModuleArgs({});
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { store } = moduleArgs;
      api.setIndex({
        v: 5,
        entries: {
          'prepared--story': {
            type: 'story',
            id: 'prepared--story',
            title: 'Prepared',
            name: 'Story',
            importPath: './path/to/prepared.ts',
            parameters: { parameter: 'exists' },
            args: { arg: 'exists' },
          },
        },
      });
      const { index } = store.getState();
      expect(index!['prepared--story']).toMatchObject({
        type: 'story',
        id: 'prepared--story',
        parent: 'prepared',
        title: 'Prepared',
        name: 'Story',
        prepared: true,
        parameters: { parameter: 'exists' },
        args: { arg: 'exists' },
      });
    });
    it('retains prepared-ness of stories', async () => {
      const fullAPI = { setOptions: vi.fn() };
      const moduleArgs = createMockModuleArgs({ fullAPI });
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { store, provider } = moduleArgs;
      api.setIndex({ v: 5, entries: mockEntries });
      provider.channel.emit(STORY_PREPARED, {
        id: 'component-a--story-1',
        parameters: { a: 'b' },
        args: { c: 'd' },
      });
      // Let the promise/await chain resolve
      await new Promise((r) => setTimeout(r, 0));
      expect(store.getState().index!['component-a--story-1'] as API_StoryEntry).toMatchObject({
        prepared: true,
        parameters: { a: 'b' },
        args: { c: 'd' },
      });
      api.setIndex({ v: 5, entries: mockEntries });
      // Let the promise/await chain resolve
      await new Promise((r) => setTimeout(r, 0));
      expect(store.getState().index!['component-a--story-1'] as API_StoryEntry).toMatchObject({
        prepared: true,
        parameters: { a: 'b' },
        args: { c: 'd' },
      });
    });

    describe('docs entries', () => {
      it('handles docs entries', async () => {
        const moduleArgs = createMockModuleArgs({});
        const { api } = initStories(moduleArgs as unknown as ModuleArgs);
        const { store } = moduleArgs;

        api.setIndex({ v: 5, entries: docsEntries });
        const { index } = store.getState();
        // We need exact key ordering, even if in theory JS doesn't guarantee it
        expect(Object.keys(index!)).toEqual([
          'component-a',
          'component-a--page',
          'component-a--story-2',
          'component-b',
          'component-b--docs',
          'component-c',
          'component-c--story-4',
        ]);
        expect(index!['component-a--page'].type).toBe('story');
        expect(index!['component-a--story-2'].type).toBe('story');
        expect(index!['component-b--docs'].type).toBe('docs');
        expect(index!['component-c--story-4'].type).toBe('story');
      });
      describe('when DOCS_MODE = true', () => {
        it('strips out story entries', async () => {
          const moduleArgs = createMockModuleArgs({});
          const { api } = initStories({
            ...(moduleArgs as unknown as ModuleArgs),
            docsOptions: { docsMode: true },
          });
          const { store } = moduleArgs;
          api.setIndex({ v: 5, entries: docsEntries });
          const { index } = store.getState();
          expect(Object.keys(index!)).toEqual(['component-b', 'component-b--docs']);
        });
      });
    });
  });

  describe('SET_INDEX event', () => {
    it('calls setIndex w/ the data', () => {
      const fullAPI = { setOptions: vi.fn() };
      const moduleArgs = createMockModuleArgs({ fullAPI });
      initStories(moduleArgs as unknown as ModuleArgs);
      const { store, provider } = moduleArgs;

      provider.channel.emit(SET_INDEX, { v: 5, entries: mockEntries });
      expect(store.getState().index).toEqual(
        expect.objectContaining({
          'component-a': expect.any(Object),
          'component-a--docs': expect.any(Object),
          'component-a--story-1': expect.any(Object),
        })
      );
    });
    it('calls setOptions w/ first story parameter', () => {
      const fullAPI = { setOptions: vi.fn() };
      const moduleArgs = createMockModuleArgs({ fullAPI });
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { provider } = moduleArgs;

      // HACK api to effectively mock getCurrentParameter
      Object.assign(api, {
        getCurrentParameter: vi.fn().mockReturnValue('options'),
      });

      provider.channel.emit(SET_INDEX, { v: 5, entries: mockEntries });
      expect(fullAPI.setOptions).toHaveBeenCalledWith('options');
    });
  });

  describe('fetchIndex', () => {
    it('deals with 500 errors', async () => {
      fetch.mockReturnValue(
        Promise.resolve({
          status: 500,
          text: async () => new Error('sorting error'),
        } as any as Response)
      );
      const moduleArgs = createMockModuleArgs({});
      const { init } = initStories(moduleArgs as unknown as ModuleArgs);
      const { store } = moduleArgs;

      await init!();

      const { indexError } = store.getState();
      expect(indexError).toBeDefined();
    });
    it('watches for the INVALIDATE event and re-fetches -- and resets the hash', async () => {
      fetch.mockReturnValue(
        Promise.resolve({
          status: 200,
          ok: true,
          json: () => ({
            v: 5,
            entries: {
              'component-a--story-1': {
                type: 'story',
                id: 'component-a--story-1',
                title: 'Component A',
                name: 'Story 1',
                importPath: './path/to/component-a.ts',
              },
            },
          }),
        } as any as Response)
      );

      const moduleArgs = createMockModuleArgs({});
      const { init } = initStories(moduleArgs as unknown as ModuleArgs);
      const { store, provider } = moduleArgs;

      await init!();

      expect(fetch).toHaveBeenCalledTimes(1);
      provider.channel.emit(STORY_INDEX_INVALIDATED);
      expect(global.fetch).toHaveBeenCalledTimes(2);

      // this side-effect is in an un-awaited promise.
      await wait(16);

      const { index } = store.getState();
      expect(Object.keys(index!)).toEqual(['component-a', 'component-a--story-1']);
    });
    it('clears 500 errors when invalidated', async () => {
      fetch.mockReturnValueOnce(
        Promise.resolve({
          status: 500,
          text: async () => new Error('sorting error'),
        } as any as Response)
      );
      const moduleArgs = createMockModuleArgs({});
      const { init } = initStories(moduleArgs as unknown as ModuleArgs);
      const { store, provider } = moduleArgs;

      await init!();

      const { indexError } = store.getState();
      expect(indexError).toBeDefined();

      fetch.mockReturnValueOnce(
        Promise.resolve({
          status: 200,
          ok: true,
          json: () => ({
            v: 5,
            entries: {
              'component-a--story-1': {
                type: 'story',
                id: 'component-a--story-1',
                title: 'Component A',
                name: 'Story 1',
                importPath: './path/to/component-a.ts',
              },
            },
          }),
        } as any as Response)
      );

      provider.channel.emit(STORY_INDEX_INVALIDATED);
      expect(global.fetch).toHaveBeenCalledTimes(2);

      // this side-effect is in an un-awaited promise.
      await wait(16);

      const { index, indexError: newIndexError } = store.getState();
      expect(newIndexError).not.toBeDefined();
      expect(Object.keys(index!)).toEqual(['component-a', 'component-a--story-1']);
    });
  });

  describe('STORY_SPECIFIED event', () => {
    it('navigates to the story', async () => {
      const moduleArgs = createMockModuleArgs({ initialState: { path: '/', index: {} } });
      initStories(moduleArgs as unknown as ModuleArgs);
      const { navigate, provider } = moduleArgs;

      provider.channel.emit(STORY_SPECIFIED, { storyId: 'a--1', viewMode: 'story' });
      expect(navigate).toHaveBeenCalledWith('/story/a--1');
    });
    it('DOES not navigate if the story was already selected', async () => {
      const moduleArgs = createMockModuleArgs({ initialState: { path: '/story/a--1', index: {} } });
      initStories(moduleArgs as unknown as ModuleArgs);
      const { navigate, provider } = moduleArgs;

      provider.channel.emit(STORY_SPECIFIED, { storyId: 'a--1', viewMode: 'story' });
      expect(navigate).not.toHaveBeenCalled();
    });
    it('DOES not navigate if a settings page was selected', async () => {
      const moduleArgs = createMockModuleArgs({
        initialState: { path: '/settings/about', index: {} },
      });
      initStories(moduleArgs as unknown as ModuleArgs);
      const { navigate, provider } = moduleArgs;

      provider.channel.emit(STORY_SPECIFIED, { storyId: 'a--1', viewMode: 'story' });
      expect(navigate).not.toHaveBeenCalled();
    });
    it('DOES not navigate if a custom page was selected', async () => {
      const moduleArgs = createMockModuleArgs({
        initialState: { path: '/custom/page', index: {} },
      });
      initStories(moduleArgs as unknown as ModuleArgs);
      const { navigate, provider } = moduleArgs;

      provider.channel.emit(STORY_SPECIFIED, { storyId: 'a--1', viewMode: 'story' });
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe('CURRENT_STORY_WAS_SET event', () => {
    it('sets previewInitialized', async () => {
      const moduleArgs = createMockModuleArgs({});
      initStories(moduleArgs as unknown as ModuleArgs);
      const { store, provider } = moduleArgs;
      provider.channel.emit(CURRENT_STORY_WAS_SET, { id: 'a--1' });

      expect(store.getState().previewInitialized).toBe(true);
    });
    it('sets a ref to previewInitialized', async () => {
      const fullAPI = { updateRef: vi.fn() };
      const moduleArgs = createMockModuleArgs({ fullAPI });
      initStories(moduleArgs as unknown as ModuleArgs);
      const { provider } = moduleArgs;
      provider.channel.emit(CURRENT_STORY_WAS_SET, { id: 'a--1' });

      getEventMetadata.mockReturnValueOnce({
        sourceType: 'external',
        refId: 'refId',
        source: '',
        sourceLocation: '',
        type: '',
        ref: { id: 'refId', index: { 'a--1': { args: { a: 'b' } } } } as any,
      });
      provider.channel.emit(CURRENT_STORY_WAS_SET, { id: 'a--1' });
      expect(fullAPI.updateRef.mock.calls.length).toBe(1);
      expect(fullAPI.updateRef.mock.calls[0][1]).toEqual({
        previewInitialized: true,
      });
    });
  });

  describe('args handling', () => {
    it('changes args properly, per story when receiving STORY_ARGS_UPDATED', () => {
      const fullAPI = { updateRef: vi.fn() };
      const moduleArgs = createMockModuleArgs({ fullAPI });
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { provider, store } = moduleArgs;

      api.setIndex({ v: 5, entries: preparedEntries });
      const { index } = store.getState();
      expect((index!['a--1'] as API_StoryEntry).args).toEqual({ a: 'b' });
      expect((index!['b--1'] as API_StoryEntry).args).toEqual({ x: 'y' });
      provider.channel.emit(STORY_ARGS_UPDATED, { storyId: 'a--1', args: { foo: 'bar' } });
      const { index: changedIndex } = store.getState();
      expect((changedIndex!['a--1'] as API_StoryEntry).args).toEqual({ foo: 'bar' });
      expect((changedIndex!['b--1'] as API_StoryEntry).args).toEqual({ x: 'y' });
    });
    it('changes reffed args properly, per story when receiving STORY_ARGS_UPDATED', () => {
      const fullAPI = { updateRef: vi.fn() };
      const moduleArgs = createMockModuleArgs({ fullAPI });
      initStories(moduleArgs as unknown as ModuleArgs);
      const { provider } = moduleArgs;

      getEventMetadata.mockReturnValueOnce({
        sourceType: 'external',
        refId: 'refId',
        source: '',
        sourceLocation: '',
        type: '',
        ref: { id: 'refId', index: { 'a--1': { args: { a: 'b' } } } } as any,
      });
      provider.channel.emit(STORY_ARGS_UPDATED, { storyId: 'a--1', args: { foo: 'bar' } });
      expect(fullAPI.updateRef).toHaveBeenCalledWith('refId', {
        index: { 'a--1': { args: { foo: 'bar' } } },
      });
    });
    it('updateStoryArgs emits UPDATE_STORY_ARGS to the local frame and does not change anything', () => {
      const fullAPI = { updateRef: vi.fn() };
      const moduleArgs = createMockModuleArgs({ fullAPI });
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { provider, store } = moduleArgs;

      const listener = vi.fn();
      provider.channel.on(UPDATE_STORY_ARGS, listener);

      api.setIndex({ v: 5, entries: preparedEntries });
      api.updateStoryArgs({ id: 'a--1' } as API_StoryEntry, { foo: 'bar' });

      expect(listener).toHaveBeenCalledWith({
        storyId: 'a--1',
        updatedArgs: { foo: 'bar' },
        options: {
          target: undefined,
        },
      });

      const { index } = store.getState();
      expect((index!['a--1'] as API_StoryEntry).args).toEqual({ a: 'b' });
      expect((index!['b--1'] as API_StoryEntry).args).toEqual({ x: 'y' });
    });
    it('updateStoryArgs emits UPDATE_STORY_ARGS to the right frame', () => {
      const fullAPI = { updateRef: vi.fn() };
      const moduleArgs = createMockModuleArgs({ fullAPI });
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { provider } = moduleArgs;

      const listener = vi.fn();
      provider.channel.on(UPDATE_STORY_ARGS, listener);

      api.setIndex({ v: 5, entries: preparedEntries });
      api.updateStoryArgs({ id: 'a--1', refId: 'refId' } as API_StoryEntry, { foo: 'bar' });
      expect(listener).toHaveBeenCalledWith({
        storyId: 'a--1',
        updatedArgs: { foo: 'bar' },
        options: {
          target: 'refId',
        },
      });
    });
    it('refId to the local frame and does not change anything', () => {
      const fullAPI = { updateRef: vi.fn() };
      const moduleArgs = createMockModuleArgs({ fullAPI });
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { provider, store } = moduleArgs;
      const listener = vi.fn();
      provider.channel.on(RESET_STORY_ARGS, listener);

      api.setIndex({ v: 5, entries: preparedEntries });
      api.resetStoryArgs({ id: 'a--1' } as API_StoryEntry, ['foo']);

      expect(listener).toHaveBeenCalledWith({
        storyId: 'a--1',
        argNames: ['foo'],
        options: {
          target: undefined,
        },
      });

      const { index } = store.getState();
      expect((index!['a--1'] as API_StoryEntry).args).toEqual({ a: 'b' });
      expect((index!['b--1'] as API_StoryEntry).args).toEqual({ x: 'y' });
    });
    it('resetStoryArgs emits RESET_STORY_ARGS to the right frame', () => {
      const fullAPI = { updateRef: vi.fn() };
      const moduleArgs = createMockModuleArgs({ fullAPI });
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { provider } = moduleArgs;

      const listener = vi.fn();
      provider.channel.on(RESET_STORY_ARGS, listener);

      api.setIndex({ v: 5, entries: preparedEntries });
      api.resetStoryArgs({ id: 'a--1', refId: 'refId' } as API_StoryEntry, ['foo']);
      expect(listener).toHaveBeenCalledWith({
        storyId: 'a--1',
        argNames: ['foo'],
        options: {
          target: 'refId',
        },
      });
    });
  });

  describe('jumpToStory', () => {
    it('works forward', () => {
      const initialState = { path: '/story/a--1', storyId: 'a--1', viewMode: 'story' };
      const moduleArgs = createMockModuleArgs({ initialState });
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { navigate } = moduleArgs;

      api.setIndex({ v: 5, entries: navigationEntries });
      api.jumpToStory(1);

      expect(navigate).toHaveBeenCalledWith('/story/a--2');
    });
    it('works backwards', () => {
      const initialState = { path: '/story/a--2', storyId: 'a--2', viewMode: 'story' };
      const moduleArgs = createMockModuleArgs({ initialState });
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { navigate } = moduleArgs;

      api.setIndex({ v: 5, entries: navigationEntries });
      api.jumpToStory(-1);

      expect(navigate).toHaveBeenCalledWith('/story/a--1');
    });
    it('does nothing if you are at the last story and go forward', () => {
      const initialState = {
        path: '/story/custom-id--1',
        storyId: 'custom-id--1',
        viewMode: 'story',
      };
      const moduleArgs = createMockModuleArgs({ initialState });
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { navigate } = moduleArgs;

      api.setIndex({ v: 5, entries: navigationEntries });
      api.jumpToStory(1);
      expect(navigate).not.toHaveBeenCalled();
    });
    it('does nothing if you are at the first story and go backward', () => {
      const initialState = { path: '/story/a--1', storyId: 'a--1', viewMode: 'story' };
      const moduleArgs = createMockModuleArgs({ initialState });
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { navigate } = moduleArgs;

      api.setIndex({ v: 5, entries: navigationEntries });
      api.jumpToStory(-1);
      expect(navigate).not.toHaveBeenCalled();
    });
    it('does nothing if you have not selected a story', () => {
      const initialState = { path: '/story', storyId: undefined, viewMode: 'story' };
      const moduleArgs = createMockModuleArgs({ initialState });
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { navigate } = moduleArgs;

      api.setIndex({ v: 5, entries: navigationEntries });
      api.jumpToStory(1);
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe('findSiblingStoryId', () => {
    it('works forward', () => {
      const initialState = { path: '/story/a--1', storyId: 'a--1', viewMode: 'story' };
      const moduleArgs = createMockModuleArgs({ initialState });
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { store } = moduleArgs;

      api.setIndex({ v: 5, entries: navigationEntries });
      const result = api.findSiblingStoryId('a--1', store.getState().index!, 1, false);
      expect(result).toBe('a--2');
    });
    it('works forward toSiblingGroup', () => {
      const initialState = { path: '/story/a--1', storyId: 'a--1', viewMode: 'story' };
      const moduleArgs = createMockModuleArgs({ initialState });
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { store } = moduleArgs;

      api.setIndex({ v: 5, entries: navigationEntries });
      const result = api.findSiblingStoryId('a--1', store.getState().index!, 1, true);
      expect(result).toBe('b-c--1');
    });
  });
  describe('jumpToComponent', () => {
    it('works forward', () => {
      const initialState = { path: '/story/a--1', storyId: 'a--1', viewMode: 'story' };
      const moduleArgs = createMockModuleArgs({ initialState });
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { navigate } = moduleArgs;

      api.setIndex({ v: 5, entries: navigationEntries });
      api.jumpToComponent(1);
      expect(navigate).toHaveBeenCalledWith('/story/b-c--1');
    });
    it('works backwards', () => {
      const initialState = {
        path: '/story/b-c--1',
        storyId: 'b-c--1',
        viewMode: 'story',
      };
      const moduleArgs = createMockModuleArgs({ initialState });
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { navigate } = moduleArgs;

      api.setIndex({ v: 5, entries: navigationEntries });
      api.jumpToComponent(-1);
      expect(navigate).toHaveBeenCalledWith('/story/a--1');
    });
    it('does nothing if you are in the last component and go forward', () => {
      const initialState = {
        path: '/story/custom-id--1',
        storyId: 'custom-id--1',
        viewMode: 'story',
      };
      const moduleArgs = createMockModuleArgs({ initialState });
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { navigate } = moduleArgs;

      api.setIndex({ v: 5, entries: navigationEntries });
      api.jumpToComponent(1);
      expect(navigate).not.toHaveBeenCalled();
    });
    it('does nothing if you are at the first component and go backward', () => {
      const initialState = { path: '/story/a--2', storyId: 'a--2', viewMode: 'story' };
      const moduleArgs = createMockModuleArgs({ initialState });
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { navigate } = moduleArgs;

      api.setIndex({ v: 5, entries: navigationEntries });
      api.jumpToComponent(-1);
      expect(navigate).not.toHaveBeenCalled();
    });
  });
  describe('selectStory', () => {
    it('navigates', () => {
      const initialState = { path: '/story/a--1', storyId: 'a--1', viewMode: 'story' };
      const moduleArgs = createMockModuleArgs({ initialState });
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { navigate } = moduleArgs;

      api.setIndex({ v: 5, entries: navigationEntries });
      api.selectStory('a--2');
      expect(navigate).toHaveBeenCalledWith('/story/a--2');
    });
    it('sets view mode to docs if doc-level component is selected', () => {
      const initialState = { path: '/docs/a--1', storyId: 'a--1', viewMode: 'docs' };
      const moduleArgs = createMockModuleArgs({ initialState });
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { navigate } = moduleArgs;

      api.setIndex({
        v: 5,
        entries: {
          ...navigationEntries,
          'intro--docs': {
            type: 'docs',
            id: 'intro--docs',
            title: 'Intro',
            name: 'Page',
            importPath: './intro.mdx',
            storiesImports: [],
          },
        },
      });
      api.selectStory('intro');
      expect(navigate).toHaveBeenCalledWith('/docs/intro--docs');
    });
    it('updates lastTrackedStoryId', () => {
      const initialState = { path: '/story/a--1', storyId: 'a--1', viewMode: 'story' };
      const moduleArgs = createMockModuleArgs({ initialState });
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { store } = moduleArgs;

      api.setIndex({ v: 5, entries: navigationEntries });
      api.selectStory('a--1');
      expect(store.getState().settings.lastTrackedStoryId).toBe('a--1');
    });
    describe('deprecated api', () => {
      it('allows navigating to a combination of title + name', () => {
        const initialState = { path: '/story/a--1', storyId: 'a--1', viewMode: 'story' };
        const moduleArgs = createMockModuleArgs({ initialState });
        const { api } = initStories(moduleArgs as unknown as ModuleArgs);
        const { navigate } = moduleArgs;

        api.setIndex({ v: 5, entries: navigationEntries });
        api.selectStory('a', '2');
        expect(navigate).toHaveBeenCalledWith('/story/a--2');
      });
      it('allows navigating to a given name (in the current component)', () => {
        const initialState = { path: '/story/a--1', storyId: 'a--1', viewMode: 'story' };
        const moduleArgs = createMockModuleArgs({ initialState });
        const { api } = initStories(moduleArgs as unknown as ModuleArgs);
        const { navigate } = moduleArgs;

        api.setIndex({ v: 5, entries: navigationEntries });
        api.selectStory(undefined, '2');
        expect(navigate).toHaveBeenCalledWith('/story/a--2');
      });
    });
    it('allows navigating away from the settings pages', () => {
      const initialState = { path: '/settings/a--1', storyId: 'a--1', viewMode: 'settings' };
      const moduleArgs = createMockModuleArgs({ initialState });
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { navigate } = moduleArgs;

      api.setIndex({ v: 5, entries: navigationEntries });
      api.selectStory('a--2');
      expect(navigate).toHaveBeenCalledWith('/story/a--2');
    });
    it('allows navigating to first story in component on call by component id', () => {
      const initialState = { path: '/story/a--1', storyId: 'a--1', viewMode: 'story' };
      const moduleArgs = createMockModuleArgs({ initialState });
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { navigate } = moduleArgs;

      api.setIndex({ v: 5, entries: navigationEntries });
      api.selectStory('a');
      expect(navigate).toHaveBeenCalledWith('/story/a--1');
    });
    it('allows navigating to first story in group on call by group id', () => {
      const initialState = { path: '/story/a--1', storyId: 'a--1', viewMode: 'story' };
      const moduleArgs = createMockModuleArgs({ initialState });
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { navigate } = moduleArgs;

      api.setIndex({ v: 5, entries: navigationEntries });
      api.selectStory('b');
      expect(navigate).toHaveBeenCalledWith('/story/b-c--1');
    });
    it('allows navigating to first story in component on call by title', () => {
      const initialState = { path: '/story/a--1', storyId: 'a--1', viewMode: 'story' };
      const moduleArgs = createMockModuleArgs({ initialState });
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { navigate } = moduleArgs;

      api.setIndex({ v: 5, entries: navigationEntries });
      api.selectStory('A');
      expect(navigate).toHaveBeenCalledWith('/story/a--1');
    });
    it('allows navigating to the first story of the current component if passed nothing', () => {
      const initialState = { path: '/story/a--1', storyId: 'a--1', viewMode: 'story' };
      const moduleArgs = createMockModuleArgs({ initialState });
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { navigate } = moduleArgs;

      api.setIndex({ v: 5, entries: navigationEntries });
      api.selectStory();
      expect(navigate).toHaveBeenCalledWith('/story/a--1');
    });
    describe('component permalinks', () => {
      it('allows navigating to kind/storyname (legacy api)', () => {
        const initialState = { path: '/story/a--1', storyId: 'a--1', viewMode: 'story' };
        const moduleArgs = createMockModuleArgs({ initialState });
        const { api } = initStories(moduleArgs as unknown as ModuleArgs);
        const { navigate } = moduleArgs;

        api.setIndex({ v: 5, entries: navigationEntries });
        api.selectStory('b/e', '1');
        expect(navigate).toHaveBeenCalledWith('/story/custom-id--1');
      });
      it('allows navigating to component permalink/storyname (legacy api)', () => {
        const initialState = { path: '/story/a--1', storyId: 'a--1', viewMode: 'story' };
        const moduleArgs = createMockModuleArgs({ initialState });
        const { api } = initStories(moduleArgs as unknown as ModuleArgs);
        const { navigate } = moduleArgs;

        api.setIndex({ v: 5, entries: navigationEntries });
        api.selectStory('custom-id', '1');
        expect(navigate).toHaveBeenCalledWith('/story/custom-id--1');
      });
      it('allows navigating to first story in kind on call by kind', () => {
        const initialState = { path: '/story/a--1', storyId: 'a--1', viewMode: 'story' };
        const moduleArgs = createMockModuleArgs({ initialState });
        const { api } = initStories(moduleArgs as unknown as ModuleArgs);
        const { navigate } = moduleArgs;

        api.setIndex({ v: 5, entries: navigationEntries });
        api.selectStory('b/e');
        expect(navigate).toHaveBeenCalledWith('/story/custom-id--1');
      });
    });
  });
  describe('STORY_PREPARED', () => {
    it('prepares the story', async () => {
      const fullAPI = { setOptions: vi.fn() };
      const initialState = { path: '/story/a--1', storyId: 'a--1', viewMode: 'story' };
      const moduleArgs = createMockModuleArgs({ initialState, fullAPI });
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { provider, store } = moduleArgs;

      api.setIndex({ v: 5, entries: mockEntries });

      provider.channel.emit(STORY_PREPARED, {
        id: 'component-a--story-1',
        parameters: { a: 'b' },
        args: { c: 'd' },
      });
      const { index } = store.getState();
      expect(index!['component-a--story-1']).toMatchObject({
        type: 'story',
        id: 'component-a--story-1',
        parent: 'component-a',
        title: 'Component A',
        name: 'Story 1',
        prepared: true,
        parameters: { a: 'b' },
        args: { c: 'd' },
      });
    });
    it('sets options the first time it is called', async () => {
      const fullAPI = { setOptions: vi.fn() };
      const initialState = { path: '/story/a--1', storyId: 'a--1', viewMode: 'story' };
      const moduleArgs = createMockModuleArgs({ initialState, fullAPI });
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { provider } = moduleArgs;

      api.setIndex({ v: 5, entries: mockEntries });

      provider.channel.emit(STORY_PREPARED, {
        id: 'component-a--story-1',
        parameters: { options: 'options' },
      });
      expect(fullAPI.setOptions).toHaveBeenCalledWith('options');

      fullAPI.setOptions.mockClear();

      provider.channel.emit(STORY_PREPARED, {
        id: 'component-a--story-1',
        parameters: { options: 'options2' },
      });
      expect(fullAPI.setOptions).not.toHaveBeenCalled();
    });
  });
  describe('DOCS_PREPARED', () => {
    it('prepares the docs entry', async () => {
      const moduleArgs = createMockModuleArgs({});
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { provider, store } = moduleArgs;

      api.setIndex({ v: 5, entries: mockEntries });

      provider.channel.emit(DOCS_PREPARED, {
        id: 'component-a--docs',
        parameters: { a: 'b' },
      });
      const { index } = store.getState();
      expect(index!['component-a--docs']).toMatchObject({
        type: 'docs',
        id: 'component-a--docs',
        parent: 'component-a',
        title: 'Component A',
        name: 'Docs',
        prepared: true,
        parameters: { a: 'b' },
      });
    });
  });
  describe('CONFIG_ERROR', () => {
    it('sets previewInitialized to true, local', async () => {
      const moduleArgs = createMockModuleArgs({});
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { provider, store } = moduleArgs;

      api.setIndex({ v: 5, entries: mockEntries });

      provider.channel.emit(CONFIG_ERROR, { message: 'Failed to run configure' });
      const { previewInitialized } = store.getState();
      expect(previewInitialized).toBe(true);
    });
    it('sets previewInitialized to true, ref', async () => {
      const fullAPI = { updateRef: vi.fn() };
      const moduleArgs = createMockModuleArgs({ fullAPI });
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { provider } = moduleArgs;

      api.setIndex({ v: 5, entries: mockEntries });

      getEventMetadata.mockReturnValueOnce({
        sourceType: 'external',
        ref: { id: 'refId', stories: { 'a--1': { args: { a: 'b' } } } },
      } as any);
      provider.channel.emit(CONFIG_ERROR, { message: 'Failed to run configure' });
      expect(fullAPI.updateRef.mock.calls.length).toBe(1);
      expect(fullAPI.updateRef.mock.calls[0][1]).toEqual({
        previewInitialized: true,
      });
    });
  });
  describe('STORY_MISSING', () => {
    it('sets previewInitialized to true, local', async () => {
      const moduleArgs = createMockModuleArgs({});
      initStories(moduleArgs as unknown as ModuleArgs);
      const { provider, store } = moduleArgs;

      provider.channel.emit(STORY_MISSING, { message: 'Failed to run configure' });
      const { previewInitialized } = store.getState();
      expect(previewInitialized).toBe(true);
    });
    it('sets previewInitialized to true, ref', async () => {
      const fullAPI = { updateRef: vi.fn() };
      const moduleArgs = createMockModuleArgs({ fullAPI });
      initStories(moduleArgs as unknown as ModuleArgs);
      const { provider } = moduleArgs;

      getEventMetadata.mockReturnValueOnce({
        sourceType: 'external',
        ref: { id: 'refId', stories: { 'a--1': { args: { a: 'b' } } } },
      } as any);
      provider.channel.emit(STORY_MISSING, { message: 'Failed to run configure' });
      expect(fullAPI.updateRef.mock.calls.length).toBe(1);
      expect(fullAPI.updateRef.mock.calls[0][1]).toEqual({
        previewInitialized: true,
      });
    });
  });
  describe('v2 SET_STORIES event', () => {
    it('normalizes parameters and calls setRef for external stories', () => {
      const fullAPI = {
        findRef: vi.fn(),
        setRef: vi.fn(),
      };
      const moduleArgs = createMockModuleArgs({ fullAPI });
      initStories(moduleArgs as unknown as ModuleArgs);
      const { provider, store } = moduleArgs;

      getEventMetadata.mockReturnValueOnce({
        sourceType: 'external',
        ref: { id: 'ref' },
      } as any);
      const setStoriesPayload = {
        v: 2,
        globalParameters: { global: 'global' },
        kindParameters: { a: { kind: 'kind' } },
        stories: { 'a--1': { kind: 'a', parameters: { story: 'story' } } },
      };
      provider.channel.emit(SET_STORIES, setStoriesPayload);
      expect(store.getState().index).toBeUndefined();
      expect(fullAPI.setRef).toHaveBeenCalledWith(
        'ref',
        {
          id: 'ref',
          setStoriesData: {
            'a--1': { kind: 'a', parameters: { global: 'global', kind: 'kind', story: 'story' } },
          },
        },
        true
      );
    });
  });
  describe('legacy (v1) SET_STORIES event', () => {
    it('calls setRef with stories', () => {
      const fullAPI = {
        findRef: vi.fn(),
        setRef: vi.fn(),
      };
      const moduleArgs = createMockModuleArgs({ fullAPI });
      initStories(moduleArgs as unknown as ModuleArgs);
      const { provider, store } = moduleArgs;

      getEventMetadata.mockReturnValueOnce({
        sourceType: 'external',
        ref: { id: 'ref' },
      } as any);
      const setStoriesPayload = {
        stories: { 'a--1': {} },
      };
      provider.channel.emit(SET_STORIES, setStoriesPayload);
      expect(store.getState().index).toBeUndefined();
      expect(fullAPI.setRef).toHaveBeenCalledWith(
        'ref',
        {
          id: 'ref',
          setStoriesData: {
            'a--1': {},
          },
        },
        true
      );
    });
  });
  describe('experimental_updateStatus', () => {
    it('is included in the initial state', () => {
      const moduleArgs = createMockModuleArgs({});
      const { state } = initStories(moduleArgs as unknown as ModuleArgs);

      expect(state).toEqual(
        expect.objectContaining({
          status: {},
        })
      );
    });
    it('updates a story', async () => {
      const moduleArgs = createMockModuleArgs({});
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { store } = moduleArgs;

      await api.setIndex({ v: 5, entries: mockEntries });

      await expect(
        api.experimental_updateStatus('a-addon-id', {
          'a-story-id': {
            status: 'pending',
            title: 'an addon title',
            description: 'an addon description',
          },
        })
      ).resolves.not.toThrow();
      expect(store.getState().status).toMatchInlineSnapshot(`
        {
          "a-story-id": {
            "a-addon-id": {
              "description": "an addon description",
              "status": "pending",
              "title": "an addon title",
            },
          },
        }
      `);
    });
    it('skips updating index, if index is unset', async () => {
      const moduleArgs = createMockModuleArgs({});
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { store } = moduleArgs;

      await expect(
        api.experimental_updateStatus('a-addon-id', {
          'a-story-id': {
            status: 'pending',
            title: 'an addon title',
            description: 'an addon description',
          },
        })
      ).resolves.not.toThrow();
      expect(store.getState().status).toMatchInlineSnapshot(`
        {
          "a-story-id": {
            "a-addon-id": {
              "description": "an addon description",
              "status": "pending",
              "title": "an addon title",
            },
          },
        }
      `);
    });
    it('updates multiple stories', async () => {
      const moduleArgs = createMockModuleArgs({});
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { store } = moduleArgs;

      await api.setIndex({ v: 5, entries: mockEntries });

      await expect(
        api.experimental_updateStatus('a-addon-id', {
          'a-story-id': {
            status: 'pending',
            title: 'an addon title',
            description: 'an addon description',
          },
          'another-story-id': { status: 'success', title: 'a addon title', description: '' },
        })
      ).resolves.not.toThrow();
      expect(store.getState().status).toMatchInlineSnapshot(`
        {
          "a-story-id": {
            "a-addon-id": {
              "description": "an addon description",
              "status": "pending",
              "title": "an addon title",
            },
          },
          "another-story-id": {
            "a-addon-id": {
              "description": "",
              "status": "success",
              "title": "a addon title",
            },
          },
        }
      `);
    });
    it('delete when value is null', async () => {
      const moduleArgs = createMockModuleArgs({});
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { store } = moduleArgs;

      await api.setIndex({ v: 5, entries: mockEntries });

      await expect(
        api.experimental_updateStatus('a-addon-id', {
          'a-story-id': {
            status: 'pending',
            title: 'an addon title',
            description: 'an addon description',
          },
          'another-story-id': { status: 'success', title: 'a addon title', description: '' },
        })
      ).resolves.not.toThrow();

      // do a second update, this time with null
      await expect(
        api.experimental_updateStatus('a-addon-id', {
          'a-story-id': null!,
          'another-story-id': { status: 'success', title: 'a addon title', description: '' },
        })
      ).resolves.not.toThrow();

      expect(store.getState().status).toMatchInlineSnapshot(`
        {
          "another-story-id": {
            "a-addon-id": {
              "description": "",
              "status": "success",
              "title": "a addon title",
            },
          },
        }
      `);
    });
    it('updates with a function', async () => {
      const moduleArgs = createMockModuleArgs({});
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { store } = moduleArgs;

      await api.setIndex({ v: 5, entries: mockEntries });

      // setup initial state
      await expect(
        api.experimental_updateStatus('a-addon-id', () => ({
          'a-story-id': {
            status: 'pending',
            title: 'an addon title',
            description: 'an addon description',
          },
          'another-story-id': { status: 'success', title: 'a addon title', description: '' },
        }))
      ).resolves.not.toThrow();

      // use existing state in function
      await expect(
        api.experimental_updateStatus('a-addon-id', (current: any) => {
          return Object.fromEntries(
            Object.entries(current).map(([k, v]: any) => [
              k,
              { ...v['a-addon-id'], status: 'success' },
            ])
          );
        })
      ).resolves.not.toThrow();
      expect(store.getState().status).toMatchInlineSnapshot(`
        {
          "a-story-id": {
            "a-addon-id": {
              "description": "an addon description",
              "status": "success",
              "title": "an addon title",
            },
          },
          "another-story-id": {
            "a-addon-id": {
              "description": "",
              "status": "success",
              "title": "a addon title",
            },
          },
        }
      `);
    });
  });
  describe('experimental_setFilter', () => {
    it('is included in the initial state', async () => {
      const moduleArgs = createMockModuleArgs({});
      const { state, api } = initStories(moduleArgs as unknown as ModuleArgs);

      await api.setIndex({ v: 5, entries: mockEntries });

      expect(state).toEqual(
        expect.objectContaining({
          filters: {},
        })
      );
    });
    it('updates state', async () => {
      const moduleArgs = createMockModuleArgs({});
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { store } = moduleArgs;

      await api.setIndex({ v: 5, entries: mockEntries });

      api.experimental_setFilter('myCustomFilter', () => true);

      expect(store.getState()).toEqual(
        expect.objectContaining({
          filters: {
            myCustomFilter: expect.any(Function),
          },
        })
      );
    });

    it('can filter', async () => {
      const moduleArgs = createMockModuleArgs({});
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { store } = moduleArgs;

      await api.setIndex({ v: 5, entries: navigationEntries });
      await api.experimental_setFilter('myCustomFilter', (item: any) => item.id.startsWith('a'));

      const { index } = store.getState();

      expect(index).toMatchInlineSnapshot(`
        {
          "a": {
            "children": [
              "a--1",
              "a--2",
            ],
            "depth": 0,
            "id": "a",
            "name": "a",
            "parent": undefined,
            "renderLabel": undefined,
            "tags": [],
            "type": "component",
          },
          "a--1": {
            "depth": 1,
            "id": "a--1",
            "importPath": "./a.ts",
            "name": "1",
            "parent": "a",
            "prepared": false,
            "renderLabel": undefined,
            "title": "a",
            "type": "story",
          },
          "a--2": {
            "depth": 1,
            "id": "a--2",
            "importPath": "./a.ts",
            "name": "2",
            "parent": "a",
            "prepared": false,
            "renderLabel": undefined,
            "title": "a",
            "type": "story",
          },
        }
      `);
    });

    it('can filter on status', async () => {
      const moduleArgs = createMockModuleArgs({});
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { store } = moduleArgs;

      await api.setIndex({ v: 5, entries: navigationEntries });
      await api.experimental_setFilter(
        'myCustomFilter',
        (item: any) =>
          item.status !== undefined &&
          Object.values(item.status).some((v: any) => v.status === 'pending')
      );

      // empty, because there are no stories with status
      expect(store.getState().index).toMatchInlineSnapshot('{}');

      // setting status should update the index
      await api.experimental_updateStatus('a-addon-id', {
        'a--1': {
          status: 'pending',
          title: 'an addon title',
          description: 'an addon description',
        },
        'a--2': { status: 'success', title: 'a addon title', description: '' },
      });

      expect(store.getState().index).toMatchInlineSnapshot(`
        {
          "a": {
            "children": [
              "a--1",
            ],
            "depth": 0,
            "id": "a",
            "name": "a",
            "parent": undefined,
            "renderLabel": undefined,
            "tags": [],
            "type": "component",
          },
          "a--1": {
            "depth": 1,
            "id": "a--1",
            "importPath": "./a.ts",
            "name": "1",
            "parent": "a",
            "prepared": false,
            "renderLabel": undefined,
            "title": "a",
            "type": "story",
          },
        }
      `);
    });

    it('persists filter when index is updated', async () => {
      const moduleArgs = createMockModuleArgs({});
      const { api } = initStories(moduleArgs as unknown as ModuleArgs);
      const { store } = moduleArgs;

      await api.setIndex({ v: 5, entries: navigationEntries });
      await api.experimental_setFilter('myCustomFilter', (item: any) => item.id.startsWith('a'));

      await api.setIndex({ v: 5, entries: navigationEntries });

      const { index } = store.getState();

      expect(index).toMatchInlineSnapshot(`
        {
          "a": {
            "children": [
              "a--1",
              "a--2",
            ],
            "depth": 0,
            "id": "a",
            "name": "a",
            "parent": undefined,
            "renderLabel": undefined,
            "tags": [],
            "type": "component",
          },
          "a--1": {
            "depth": 1,
            "id": "a--1",
            "importPath": "./a.ts",
            "name": "1",
            "parent": "a",
            "prepared": false,
            "renderLabel": undefined,
            "title": "a",
            "type": "story",
          },
          "a--2": {
            "depth": 1,
            "id": "a--2",
            "importPath": "./a.ts",
            "name": "2",
            "parent": "a",
            "prepared": false,
            "renderLabel": undefined,
            "title": "a",
            "type": "story",
          },
        }
      `);
    });
  });
});
