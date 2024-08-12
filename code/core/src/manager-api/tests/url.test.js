import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  GLOBALS_UPDATED,
  SET_CURRENT_STORY,
  UPDATE_QUERY_PARAMS,
} from '@storybook/core/core-events';

import EventEmitter from 'events';

import { init as initURL } from '../modules/url';

vi.mock('@storybook/core/client-logger');
vi.useFakeTimers();

describe('initial state', () => {
  const viewMode = 'story';

  describe('config query parameters', () => {
    it('handles full parameter', () => {
      const navigate = vi.fn();
      const location = { search: new URLSearchParams({ full: '1' }).toString() };

      const {
        state: { layout },
      } = initURL({ navigate, state: { location }, provider: { channel: new EventEmitter() } });

      expect(layout).toMatchObject({
        bottomPanelHeight: 0,
        navSize: 0,
        rightPanelWidth: 0,
      });
    });

    it('handles nav parameter', () => {
      const navigate = vi.fn();
      const location = { search: new URLSearchParams({ nav: '0' }).toString() };

      const {
        state: { layout },
      } = initURL({ navigate, state: { location }, provider: { channel: new EventEmitter() } });

      expect(layout).toMatchObject({ navSize: 0 });
    });

    it('handles shortcuts parameter', () => {
      const navigate = vi.fn();
      const location = { search: new URLSearchParams({ shortcuts: '0' }).toString() };

      const {
        state: { ui },
      } = initURL({ navigate, state: { location }, provider: { channel: new EventEmitter() } });

      expect(ui).toEqual({ enableShortcuts: false });
    });

    it('handles panel parameter, bottom', () => {
      const navigate = vi.fn();
      const location = { search: new URLSearchParams({ panel: 'bottom' }).toString() };

      const {
        state: { layout },
      } = initURL({ navigate, state: { location }, provider: { channel: new EventEmitter() } });

      expect(layout).toMatchObject({ panelPosition: 'bottom' });
    });

    it('handles panel parameter, right', () => {
      const navigate = vi.fn();
      const location = { search: new URLSearchParams({ panel: 'right' }).toString() };

      const {
        state: { layout },
      } = initURL({ navigate, state: { location }, provider: { channel: new EventEmitter() } });

      expect(layout).toMatchObject({ panelPosition: 'right' });
    });

    it('handles panel parameter, 0', () => {
      const navigate = vi.fn();
      const location = { search: new URLSearchParams({ panel: '0' }).toString() };

      const {
        state: { layout },
      } = initURL({ navigate, state: { location }, provider: { channel: new EventEmitter() } });

      expect(layout).toMatchObject({
        bottomPanelHeight: 0,
        rightPanelWidth: 0,
      });
    });
  });
});

describe('queryParams', () => {
  it('lets your read out parameters you set previously', () => {
    let state = {};
    const store = {
      setState: (change) => {
        state = { ...state, ...change };
      },
      getState: () => state,
    };
    const channel = new EventEmitter();
    const { api } = initURL({
      state: { location: { search: '' } },
      navigate: vi.fn(),
      store,
      provider: { channel },
    });

    const listener = vi.fn();

    channel.on(UPDATE_QUERY_PARAMS, listener);

    api.setQueryParams({ foo: 'bar' });

    expect(api.getQueryParam('foo')).toEqual('bar');

    expect(listener).toHaveBeenCalledWith({ foo: 'bar' });
  });
});

describe('initModule', () => {
  const store = {
    state: {},
    getState() {
      return this.state;
    },
    setState(value) {
      this.state = { ...this.state, ...value };
    },
  };
  const storyState = (storyId) => ({
    path: `/story/${storyId}`,
    storyId,
    viewMode: 'story',
  });

  const fullAPI = {
    showReleaseNotesOnLaunch: vi.fn(),
  };

  beforeEach(() => {
    store.state = {};
    fullAPI.callbacks = {};
  });

  it('updates args param on SET_CURRENT_STORY', async () => {
    store.setState(storyState('test--story'));

    const navigate = vi.fn();
    const channel = new EventEmitter();
    initURL({
      store,
      provider: { channel },
      state: { location: {} },
      navigate,
      fullAPI: Object.assign(fullAPI, {
        getCurrentStoryData: () => ({
          type: 'story',
          args: { a: 1, b: 2 },
          initialArgs: { a: 1, b: 1 },
        }),
      }),
    });
    channel.emit(SET_CURRENT_STORY);
    expect(navigate).toHaveBeenCalledWith(
      '/story/test--story&args=b:2',
      expect.objectContaining({ replace: true })
    );
    expect(store.getState().customQueryParams).toEqual({ args: 'b:2' });
  });

  it('updates globals param on GLOBALS_UPDATED', async () => {
    store.setState(storyState('test--story'));

    const navigate = vi.fn();
    const channel = new EventEmitter();
    initURL({ store, provider: { channel }, state: { location: {} }, navigate, fullAPI });

    channel.emit(GLOBALS_UPDATED, {
      userGlobals: { a: 2 },
      storyGlobals: {},
      globals: { a: 2 },
      initialGlobals: { a: 1, b: 1 },
    });
    expect(navigate).toHaveBeenCalledWith(
      '/story/test--story&globals=a:2;b:!undefined',
      expect.objectContaining({ replace: true })
    );
    expect(store.getState().customQueryParams).toEqual({ globals: 'a:2;b:!undefined' });
  });

  it('adds url params alphabetically', async () => {
    store.setState({ ...storyState('test--story'), customQueryParams: { full: 1 } });
    const navigate = vi.fn();
    const channel = new EventEmitter();
    const { api } = initURL({
      store,
      provider: { channel },
      state: { location: {} },
      navigate,
      fullAPI: Object.assign(fullAPI, {
        getCurrentStoryData: () => ({ type: 'story', args: { a: 1 } }),
      }),
    });

    channel.emit(GLOBALS_UPDATED, { userGlobals: { g: 2 }, storyGlobals: {}, globals: { g: 2 } });
    expect(navigate).toHaveBeenCalledWith(
      '/story/test--story&full=1&globals=g:2',
      expect.objectContaining({ replace: true })
    );

    channel.emit(SET_CURRENT_STORY);
    expect(navigate).toHaveBeenCalledWith(
      '/story/test--story&args=a:1&full=1&globals=g:2',
      expect.objectContaining({ replace: true })
    );
  });
});
