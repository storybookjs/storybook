import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  GLOBALS_UPDATED,
  SET_CURRENT_STORY,
  UPDATE_QUERY_PARAMS,
} from 'storybook/internal/core-events';

import { global } from '@storybook/global';

import EventEmitter from 'events';

import { init as initURL } from '../modules/url';

vi.mock('storybook/internal/client-logger');
vi.mock('@storybook/global', () => ({
  global: {
    window: {
      location: {
        hash: '',
        href: 'http://localhost:6006',
        origin: 'http://localhost:6006',
      },
    },
    STORYBOOK_NETWORK_ADDRESS: 'http://192.168.1.1:6006/',
  },
}));

const storyState = (storyId) => ({
  path: `/story/${storyId}`,
  storyId,
  viewMode: 'story',
});

describe('initial state', () => {
  describe('config query parameters', () => {
    it('handles full parameter', () => {
      const navigate = vi.fn();
      const location = { search: '?' + new URLSearchParams({ full: '1' }).toString() };

      const store = {
        state: { ...storyState('test--story'), location },
        getState() {
          return this.state;
        },
        setState(value) {
          this.state = { ...this.state, ...value };
        },
      };

      const {
        state: { layout },
      } = initURL(
        { navigate, state: { location }, provider: { channel: new EventEmitter() } },
        store
      );

      expect(layout).toMatchObject({
        bottomPanelHeight: 0,
        navSize: 0,
        rightPanelWidth: 0,
      });
    });

    it('handles nav parameter', () => {
      const navigate = vi.fn();
      const location = { search: '?' + new URLSearchParams({ nav: '0' }).toString() };

      const {
        state: { layout },
      } = initURL({ navigate, state: { location }, provider: { channel: new EventEmitter() } });

      expect(layout).toMatchObject({ navSize: 0 });
    });

    it('handles shortcuts parameter', () => {
      const navigate = vi.fn();
      const location = { search: '?' + new URLSearchParams({ shortcuts: '0' }).toString() };

      const {
        state: { ui },
      } = initURL({ navigate, state: { location }, provider: { channel: new EventEmitter() } });

      expect(ui).toEqual({ enableShortcuts: false });
    });

    it('handles panel parameter, bottom', () => {
      const navigate = vi.fn();
      const location = { search: '?' + new URLSearchParams({ panel: 'bottom' }).toString() };

      const {
        state: { layout },
      } = initURL({ navigate, state: { location }, provider: { channel: new EventEmitter() } });

      expect(layout).toMatchObject({ panelPosition: 'bottom' });
    });

    it('handles panel parameter, right', () => {
      const navigate = vi.fn();
      const location = { search: '?' + new URLSearchParams({ panel: 'right' }).toString() };

      const {
        state: { layout },
      } = initURL({ navigate, state: { location }, provider: { channel: new EventEmitter() } });

      expect(layout).toMatchObject({ panelPosition: 'right' });
    });

    it('handles panel parameter, 0', () => {
      const navigate = vi.fn();
      const location = { search: '?' + new URLSearchParams({ panel: '0' }).toString() };

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

  const fullAPI = {
    showReleaseNotesOnLaunch: vi.fn(),
  };

  beforeEach(() => {
    store.state = {};
    fullAPI.callbacks = {};
  });

  it('updates args param on SET_CURRENT_STORY', async () => {
    const location = {};
    store.setState({ ...storyState('test--story'), location });

    const navigate = vi.fn();
    const channel = new EventEmitter();
    initURL({
      store,
      provider: { channel },
      state: { location },
      navigate,
      fullAPI: Object.assign(fullAPI, {
        getCurrentStoryData: () => ({
          type: 'story',
          subtype: 'story',
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
    const location = {};
    store.setState({ ...storyState('test--story'), location });

    const navigate = vi.fn();
    const channel = new EventEmitter();
    initURL({ store, provider: { channel }, state: { location }, navigate, fullAPI });

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
    const location = {};
    store.setState({ ...storyState('test--story'), customQueryParams: { full: 1 }, location });
    const navigate = vi.fn();
    const channel = new EventEmitter();
    const { api } = initURL({
      store,
      provider: { channel },
      state: { location },
      navigate,
      fullAPI: Object.assign(fullAPI, {
        getCurrentStoryData: () => ({ type: 'story', subtype: 'story', args: { a: 1 } }),
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

describe('getStoryHrefs', () => {
  let state = {};
  const store = {
    setState: (change) => {
      state = { ...state, ...change };
    },
    getState: () => state,
  };

  it('returns manager and preview URLs for a story', () => {
    const { api, state } = initURL({
      store,
      provider: { channel: new EventEmitter() },
      state: { location: { pathname: '/', search: '' } },
      navigate: vi.fn(),
      fullAPI: { getCurrentStoryData: () => ({ id: 'test--story' }) },
    });
    store.setState(state);

    const { managerHref, previewHref } = api.getStoryHrefs('test--story');
    expect(managerHref).toEqual('/?path=/story/test--story');
    expect(previewHref).toEqual('/iframe.html?id=test--story&viewMode=story');
  });

  it('retains args and globals from the URL', () => {
    const { api, state } = initURL({
      store,
      provider: { channel: new EventEmitter() },
      state: { location: { pathname: '/', search: '?args=a:1&globals=b:2' } },
      navigate: vi.fn(),
      fullAPI: { getCurrentStoryData: () => ({ id: 'test--story' }) },
    });
    store.setState(state);

    const { managerHref, previewHref } = api.getStoryHrefs('test--story');
    expect(managerHref).toContain('&args=a:1&globals=b:2');
    expect(previewHref).toContain('&args=a:1&globals=b:2');
  });

  it('retains args with special values', () => {
    const { api, state } = initURL({
      store,
      provider: { channel: new EventEmitter() },
      state: { location: { pathname: '/', search: '?args=a:!null;b:!hex(f00);c:!undefined' } },
      navigate: vi.fn(),
      fullAPI: { getCurrentStoryData: () => ({ id: 'test--story' }) },
    });
    store.setState(state);

    const { managerHref, previewHref } = api.getStoryHrefs('test--story');
    expect(managerHref).toContain('&args=a:!null;b:!hex(f00);c:!undefined');
    expect(previewHref).toContain('&args=a:!null;b:!hex(f00);c:!undefined');
  });

  it('drops args but retains globals when changing stories', () => {
    const { api, state } = initURL({
      store,
      provider: { channel: new EventEmitter() },
      state: { location: { pathname: '/', search: '?args=a:1&globals=b:2' } },
      navigate: vi.fn(),
      fullAPI: { getCurrentStoryData: () => ({ id: 'test--story' }) },
    });
    store.setState(state);

    const { managerHref, previewHref } = api.getStoryHrefs('test--another-story');
    expect(managerHref).toEqual('/?path=/story/test--another-story&globals=b:2');
    expect(previewHref).toEqual('/iframe.html?id=test--another-story&viewMode=story&globals=b:2');
  });

  it('supports disabling inheritance of args and globals', () => {
    const { api, state } = initURL({
      store,
      provider: { channel: new EventEmitter() },
      state: { location: { pathname: '/', search: '?args=a:1&globals=b:2' } },
      navigate: vi.fn(),
      fullAPI: { getCurrentStoryData: () => ({ id: 'test--story' }) },
    });
    store.setState(state);

    const { managerHref, previewHref } = api.getStoryHrefs('test--story', {
      inheritArgs: false,
      inheritGlobals: false,
    });
    expect(managerHref).toEqual('/?path=/story/test--story');
    expect(previewHref).toEqual('/iframe.html?id=test--story&viewMode=story');
  });

  it('supports extra args and globals with merging', () => {
    const { api, state } = initURL({
      store,
      provider: { channel: new EventEmitter() },
      state: { location: { pathname: '/', search: '?args=a:1;b:2&globals=c:3;d:4' } },
      navigate: vi.fn(),
      fullAPI: { getCurrentStoryData: () => ({ id: 'test--story' }) },
    });
    store.setState(state);

    const { managerHref, previewHref } = api.getStoryHrefs('test--story', {
      queryParams: { args: 'a:2;c:3', globals: 'd:5' },
    });
    expect(managerHref).toContain('&args=a:2;b:2;c:3&globals=c:3;d:5');
    expect(previewHref).toContain('&args=a:2;b:2;c:3&globals=c:3;d:5');
  });

  it('supports additional query params, including nested objects', () => {
    const { api, state } = initURL({
      store,
      provider: { channel: new EventEmitter() },
      state: { location: { pathname: '/', search: '?args=a:1&globals=b:2' } },
      navigate: vi.fn(),
      fullAPI: { getCurrentStoryData: () => ({ id: 'test--story' }) },
    });
    store.setState(state);

    const { managerHref, previewHref } = api.getStoryHrefs('test--story', {
      queryParams: { one: 1, foo: { bar: 'baz' } },
    });
    expect(managerHref).toContain('&args=a:1&globals=b:2&one=1&foo.bar=baz');
    expect(previewHref).toContain('&args=a:1&globals=b:2&one=1&foo.bar=baz');
  });

  it('correctly preserves args and globals encoding', () => {
    const { api, state } = initURL({
      store,
      provider: { channel: new EventEmitter() },
      state: { location: { pathname: '/', search: '?args=equal:g%3Dh&globals=ampersand:c%26d' } },
      navigate: vi.fn(),
      fullAPI: { getCurrentStoryData: () => ({ id: 'test--story' }) },
    });
    store.setState(state);

    const { managerHref, previewHref } = api.getStoryHrefs('test--story');
    expect(managerHref).toContain('&args=equal:g%3Dh&globals=ampersand:c%26d');
    expect(previewHref).toContain('&args=equal:g%3Dh&globals=ampersand:c%26d');
  });

  it('correctly encodes query params', () => {
    const { api, state } = initURL({
      store,
      provider: { channel: new EventEmitter() },
      state: { location: { pathname: '/' } },
      navigate: vi.fn(),
      fullAPI: { getCurrentStoryData: () => ({ id: 'test--story' }) },
    });
    store.setState(state);

    const { managerHref, previewHref } = api.getStoryHrefs('test--story', {
      queryParams: { equal: 'a=b', ampersand: 'c&d' },
    });
    expect(managerHref).toContain('&equal=a%3Db&ampersand=c%26d');
    expect(previewHref).toContain('&equal=a%3Db&ampersand=c%26d');
  });

  it('supports returning absolute URLs using the base option', () => {
    const { api, state } = initURL({
      store,
      provider: { channel: new EventEmitter() },
      state: { location: { pathname: '/', search: '' } },
      navigate: vi.fn(),
      fullAPI: { getCurrentStoryData: () => ({ id: 'test--story' }) },
    });
    store.setState(state);

    const origin = api.getStoryHrefs('test--story', { base: 'origin' });
    expect(origin.managerHref).toContain('http://localhost:6006/?path=');
    expect(origin.previewHref).toContain('http://localhost:6006/iframe.html');

    const network = api.getStoryHrefs('test--story', { base: 'network' });
    expect(network.managerHref).toContain('http://192.168.1.1:6006/?path=');
    expect(network.previewHref).toContain('http://192.168.1.1:6006/iframe.html');
  });

  it('supports linking to a ref, dropping globals in preview', () => {
    const { api, state } = initURL({
      store,
      provider: { channel: new EventEmitter() },
      state: { location: { pathname: '/', search: '?args=a:1&globals=b:2' } },
      navigate: vi.fn(),
      fullAPI: { getCurrentStoryData: () => ({ id: 'test--story' }) },
    });
    store.setState(state);
    store.setState({ refs: { external: { url: 'https://sb.example.com' } } });

    const { managerHref, previewHref } = api.getStoryHrefs('test--story', { refId: 'external' });
    expect(managerHref).toEqual('/?path=/story/external_test--story&globals=b:2');
    expect(previewHref).toEqual(
      'https://sb.example.com/iframe.html?id=test--story&viewMode=story&refId=external'
    );
  });

  it('supports PREVIEW_URL override', () => {
    global.PREVIEW_URL = 'https://custom.preview.url/';
    const { api, state } = initURL({
      store,
      provider: { channel: new EventEmitter() },
      state: { location: { pathname: '/', search: '' } },
      navigate: vi.fn(),
      fullAPI: { getCurrentStoryData: () => ({ id: 'test--story' }) },
    });
    store.setState(state);

    const { managerHref, previewHref } = api.getStoryHrefs('test--story');
    expect(managerHref).toEqual('/?path=/story/test--story');
    expect(previewHref).toEqual('https://custom.preview.url/?id=test--story&viewMode=story');
  });
});
