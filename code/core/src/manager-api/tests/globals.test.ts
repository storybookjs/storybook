import { describe, beforeEach, it, expect, vi } from 'vitest';
import { EventEmitter } from 'events';
import {
  SET_STORIES,
  SET_GLOBALS,
  UPDATE_GLOBALS,
  GLOBALS_UPDATED,
} from '@storybook/core/core-events';

import { logger as _logger } from '@storybook/core/client-logger';
import type { API } from '../root';
import type { SubAPI } from '../modules/globals';
import { init as initModule } from '../modules/globals';
import type { ModuleArgs } from '../lib/types';

import { getEventMetadata as _getEventData } from '../lib/events';

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
    });
    expect(store.getState()).toEqual({
      globals: { a: 'b' },
      globalTypes: { a: { type: { name: 'string' } } },
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
    expect(store.getState()).toEqual({ globals: {}, globalTypes: {} });
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
    });
    expect(store.getState()).toEqual({ globals: {}, globalTypes: {} });
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

    channel.emit(GLOBALS_UPDATED, { globals: { a: 'b' } });
    expect(store.getState()).toEqual({ globals: { a: 'b' }, globalTypes: {} });

    channel.emit(GLOBALS_UPDATED, { globals: { a: 'c' } });
    expect(store.getState()).toEqual({ globals: { a: 'c' }, globalTypes: {} });

    // SHOULD NOT merge global args
    channel.emit(GLOBALS_UPDATED, { globals: { d: 'e' } });
    expect(store.getState()).toEqual({ globals: { d: 'e' }, globalTypes: {} });
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
    channel.emit(GLOBALS_UPDATED, { globals: { a: 'b' } });
    expect(store.getState()).toEqual({ globals: {}, globalTypes: {} });
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
