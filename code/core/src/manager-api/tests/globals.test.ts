import { beforeEach, describe, expect, it, vi } from 'vitest';

import { logger as _logger } from 'storybook/internal/client-logger';
import {
  GLOBALS_UPDATED,
  SET_GLOBALS,
  SET_STORIES,
  UPDATE_GLOBALS,
} from 'storybook/internal/core-events';
import type { GlobalsUpdatedPayload, SetGlobalsPayload } from 'storybook/internal/types';

import { EventEmitter } from 'events';

import { getEventMetadata as _getEventData } from '../lib/events.ts';
import type { ModuleArgs } from '../lib/types.tsx';
import type { SubAPI } from '../modules/globals.ts';
import { init as initModule } from '../modules/globals.ts';
import type { API } from '../root.tsx';

const getEventMetadata = vi.mocked(_getEventData, true);
const logger = vi.mocked(_logger, true);

vi.mock('storybook/internal/client-logger');
vi.mock('../lib/events');
beforeEach(() => {
  getEventMetadata.mockReset().mockReturnValue({ sourceType: 'local' } as any);
});

function createMockStore() {
  let state = {};
  return {
    getState: vi.fn().mockImplementation(() => state),
    setState: vi.fn().mockImplementation((s) => {
      state = { ...state, ...s };
    }),
  };
}

describe('globals API', () => {
  it('sets a sensible initialState', () => {
    const store = createMockStore();
    const channel = new EventEmitter();
    const { state } = initModule({ store, provider: { channel } } as unknown as ModuleArgs);

    expect(state).toEqual({
      userGlobals: {},
      storyGlobals: {},
      globals: {},
      globalTypes: {},
    });
  });

  it('set global args on SET_GLOBALS', () => {
    const channel = new EventEmitter();
    const store = createMockStore();
    const fullAPI = {
      getRefs: () => ({}),
    } as unknown as API;
    const { state } = initModule({
      store,
      fullAPI,
      provider: { channel },
    } as unknown as ModuleArgs);
    store.setState(state);

    channel.emit(SET_GLOBALS, {
      globals: { a: 'b' },
      globalTypes: { a: {} },
    } satisfies SetGlobalsPayload);
    expect(store.getState()).toEqual({
      userGlobals: { a: 'b' },
      storyGlobals: {},
      globals: { a: 'b' },
      globalTypes: { a: {} },
    });
  });

  it('emits UPDATE_GLOBALS if retains a user globals value different to what receives on SET_GLOBALS', () => {
    const channel = new EventEmitter();
    const listener = vi.fn();
    channel.on(UPDATE_GLOBALS, listener);

    const store = createMockStore();
    const fullAPI = {
      getRefs: () => ({}),
    } as unknown as API;
    const { state } = initModule({
      store,
      fullAPI,
      provider: { channel },
    } as unknown as ModuleArgs);
    store.setState({
      ...state,
      userGlobals: { a: 'c' },
      globals: { a: 'c' },
    });

    channel.emit(SET_GLOBALS, {
      globals: { a: 'b' },
      globalTypes: { a: {} },
    } satisfies SetGlobalsPayload);
    expect(store.getState()).toEqual({
      userGlobals: { a: 'b' },
      storyGlobals: {},
      globals: { a: 'b' },
      globalTypes: { a: {} },
    });

    expect(listener).toHaveBeenCalledWith({
      globals: { a: 'c' },
      options: { target: 'storybook-preview-iframe' },
    });
  });

  it('does not push story globals to preview when SET_GLOBALS fires with empty globals', () => {
    const channel = new EventEmitter();
    const listener = vi.fn();
    channel.on(UPDATE_GLOBALS, listener);

    const store = createMockStore();
    const fullAPI = {
      getRefs: () => ({}),
    } as unknown as API;
    const { state } = initModule({
      store,
      fullAPI,
      provider: { channel },
    } as unknown as ModuleArgs);
    store.setState({
      ...state,
      userGlobals: {},
      storyGlobals: { viewport: 'mobile1' },
      globals: { viewport: 'mobile1' },
    });

    channel.emit(SET_GLOBALS, {
      globals: {},
      globalTypes: {},
    } satisfies SetGlobalsPayload);

    expect(listener).not.toHaveBeenCalled();
  });

  it('ignores SET_STORIES from other refs', () => {
    const channel = new EventEmitter();
    const fullAPI = {
      findRef: vi.fn(),
      getRefs: () => ({}),
    } as unknown as API;
    const store = createMockStore();
    const { state } = initModule({
      store,
      fullAPI,
      provider: { channel },
    } as unknown as ModuleArgs);
    store.setState(state);

    getEventMetadata.mockReturnValueOnce({ sourceType: 'external', ref: { id: 'ref' } } as any);
    channel.emit(SET_STORIES, { globals: { a: 'b' } });
    expect(store.getState()).toEqual({
      userGlobals: {},
      storyGlobals: {},
      globals: {},
      globalTypes: {},
    });
  });

  it('ignores SET_GLOBALS from other refs', () => {
    const fullAPI = {
      findRef: vi.fn(),
      getRefs: () => ({}),
    } as unknown as API;
    const channel = new EventEmitter();
    const store = createMockStore();
    const { state } = initModule({
      store,
      fullAPI,
      provider: { channel },
    } as unknown as ModuleArgs);
    store.setState(state);

    getEventMetadata.mockReturnValueOnce({ sourceType: 'external', ref: { id: 'ref' } } as any);
    channel.emit(SET_GLOBALS, {
      globals: { a: 'b' },
      globalTypes: { a: {} },
    } satisfies SetGlobalsPayload);
    expect(store.getState()).toEqual({
      userGlobals: {},
      storyGlobals: {},
      globals: {},
      globalTypes: {},
    });
  });

  it('updates the state when the preview emits GLOBALS_UPDATED', () => {
    const channel = new EventEmitter();
    const fullAPI = {
      findRef: vi.fn(),
      getRefs: () => ({}),
    } as unknown as API;
    const store = createMockStore();
    const { state } = initModule({
      store,
      fullAPI,
      provider: { channel },
    } as unknown as ModuleArgs);
    store.setState(state);

    channel.emit(GLOBALS_UPDATED, {
      initialGlobals: { a: 'b' },
      userGlobals: { a: 'b' },
      storyGlobals: {},
      globals: { a: 'b' },
    } satisfies GlobalsUpdatedPayload);
    expect(store.getState()).toEqual({
      userGlobals: { a: 'b' },
      storyGlobals: {},
      globals: { a: 'b' },
      globalTypes: {},
    });

    channel.emit(GLOBALS_UPDATED, {
      initialGlobals: { a: 'b' },
      userGlobals: { a: 'c' },
      storyGlobals: {},
      globals: { a: 'c' },
    } satisfies GlobalsUpdatedPayload);
    expect(store.getState()).toEqual({
      userGlobals: { a: 'c' },
      storyGlobals: {},
      globals: { a: 'c' },
      globalTypes: {},
    });

    // SHOULD NOT merge globals
    channel.emit(GLOBALS_UPDATED, {
      initialGlobals: { a: 'b' },
      userGlobals: { d: 'e' },
      storyGlobals: {},
      globals: { d: 'e' },
    } satisfies GlobalsUpdatedPayload);
    expect(store.getState()).toEqual({
      userGlobals: { d: 'e' },
      storyGlobals: {},
      globals: { d: 'e' },
      globalTypes: {},
    });
  });

  it('ignores GLOBALS_UPDATED from other refs', () => {
    const channel = new EventEmitter();
    const fullAPI = {
      findRef: vi.fn(),
      getRefs: () => ({}),
    } as unknown as API;
    const store = createMockStore();
    const { state } = initModule({
      store,
      fullAPI,
      provider: { channel },
    } as unknown as ModuleArgs);
    store.setState(state);

    getEventMetadata.mockReturnValueOnce({ sourceType: 'external', ref: { id: 'ref' } } as any);
    logger.warn.mockClear();
    channel.emit(GLOBALS_UPDATED, {
      initialGlobals: { a: 'b' },
      userGlobals: { a: 'b' },
      storyGlobals: {},
      globals: { a: 'b' },
    } satisfies GlobalsUpdatedPayload);
    expect(store.getState()).toEqual({
      userGlobals: {},
      storyGlobals: {},
      globals: {},
      globalTypes: {},
    });
    expect(logger.warn).toHaveBeenCalled();
  });

  it('emits UPDATE_GLOBALS when updateGlobals is called', () => {
    const channel = new EventEmitter();
    const fullAPI = {
      getRefs: () => ({}),
    } as unknown as API;
    const store = createMockStore();
    const listener = vi.fn();
    channel.on(UPDATE_GLOBALS, listener);

    const { api } = initModule({ store, fullAPI, provider: { channel } } as unknown as ModuleArgs);
    (api as SubAPI).updateGlobals({ a: 'b' });

    expect(listener).toHaveBeenCalledWith({
      globals: { a: 'b' },
      options: { target: 'storybook-preview-iframe' },
    });
  });

  it('emits UPDATE_GLOBALS to composed refs that are previewInitialized', () => {
    const channel = new EventEmitter();
    const fullAPI = {
      getRefs: () => ({
        ref1: { id: 'ref1', previewInitialized: true },
        ref2: { id: 'ref2', previewInitialized: false },
        ref3: { id: 'ref3', previewInitialized: true },
      }),
    } as unknown as API;
    const store = createMockStore();
    const listener = vi.fn();
    channel.on(UPDATE_GLOBALS, listener);

    const { api } = initModule({ store, fullAPI, provider: { channel } } as unknown as ModuleArgs);
    (api as SubAPI).updateGlobals({ a: 'b' });

    expect(listener).toHaveBeenCalledTimes(3);
    expect(listener).toHaveBeenCalledWith({
      globals: { a: 'b' },
      options: { target: 'storybook-preview-iframe' },
    });
    expect(listener).toHaveBeenCalledWith({
      globals: { a: 'b' },
      options: { target: 'storybook-ref-ref1' },
    });
    expect(listener).toHaveBeenCalledWith({
      globals: { a: 'b' },
      options: { target: 'storybook-ref-ref3' },
    });
  });
});
