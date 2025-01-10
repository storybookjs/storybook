import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { GlobalsUpdatedPayload, SetGlobalsPayload } from '@storybook/core/types';

import { logger as _logger } from '@storybook/core/client-logger';
import {
  GLOBALS_UPDATED,
  SET_GLOBALS,
  SET_STORIES,
  UPDATE_GLOBALS,
} from '@storybook/core/core-events';

import { EventEmitter } from 'events';

import { getEventMetadata as _getEventData } from '../lib/events';
import type { ModuleArgs } from '../lib/types';
import type { SubAPI } from '../modules/globals';
import { init as initModule } from '../modules/globals';
import type { API } from '../root';

const getEventMetadata = vi.mocked(_getEventData, true);
const logger = vi.mocked(_logger, true);

vi.mock('@storybook/core/client-logger');
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
    const { state } = initModule({
      store,
      provider: { channel },
    } as unknown as ModuleArgs);
    store.setState(state);

    channel.emit(SET_GLOBALS, {
      globals: { a: 'b' },
      globalTypes: { a: { type: { name: 'string' } } },
    } satisfies SetGlobalsPayload);
    expect(store.getState()).toEqual({
      userGlobals: { a: 'b' },
      storyGlobals: {},
      globals: { a: 'b' },
      globalTypes: { a: { type: { name: 'string' } } },
    });
  });

  it('emits UPDATE_GLOBALS if retains a globals value different to what recieves on SET_GLOBALS', () => {
    const channel = new EventEmitter();
    const listener = vi.fn();
    channel.on(UPDATE_GLOBALS, listener);

    const store = createMockStore();
    const { state } = initModule({
      store,
      provider: { channel },
    } as unknown as ModuleArgs);
    store.setState({
      ...state,
      globals: { a: 'c' },
    });

    channel.emit(SET_GLOBALS, {
      globals: { a: 'b' },
      globalTypes: { a: { type: { name: 'string' } } },
    } satisfies SetGlobalsPayload);
    expect(store.getState()).toEqual({
      userGlobals: { a: 'b' },
      storyGlobals: {},
      globals: { a: 'b' },
      globalTypes: { a: { type: { name: 'string' } } },
    });

    expect(listener).toHaveBeenCalledWith({
      globals: { a: 'c' },
      options: { target: 'storybook-preview-iframe' },
    });
  });

  it('ignores SET_STORIES from other refs', () => {
    const channel = new EventEmitter();
    const api = { findRef: vi.fn() };
    const store = createMockStore();
    const { state } = initModule({
      store,
      fullAPI: api,
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
    const api = { findRef: vi.fn() };
    const channel = new EventEmitter();
    const store = createMockStore();
    const { state } = initModule({
      store,
      fullAPI: api,
      provider: { channel },
    } as unknown as ModuleArgs);
    store.setState(state);

    getEventMetadata.mockReturnValueOnce({ sourceType: 'external', ref: { id: 'ref' } } as any);
    channel.emit(SET_GLOBALS, {
      globals: { a: 'b' },
      globalTypes: { a: { type: { name: 'string' } } },
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
    const api = { findRef: vi.fn() };
    const store = createMockStore();
    const { state } = initModule({
      store,
      fullAPI: api,
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
    const api = { findRef: vi.fn() };
    const store = createMockStore();
    const { state } = initModule({
      store,
      fullAPI: api,
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
    const fullAPI = {} as unknown as API;
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
});
