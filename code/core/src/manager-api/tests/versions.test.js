import { describe, it, expect, vi, beforeEach } from 'vitest';
import { global } from '@storybook/global';

import { init as initVersions } from '../modules/versions';

vi.mock('../version', () => ({
  version: '3.0.0',
}));

vi.mock('@storybook/global', () => ({
  global: {
    VERSIONCHECK: JSON.stringify({
      success: true,
      data: {
        latest: {
          version: '5.2.3',
        },
        next: {
          version: '5.3.0-alpha.15',
        },
      },
      time: 1571565216284,
    }),
  },
}));

vi.mock('@storybook/core/client-logger');

function createMockStore() {
  let state = {
    versions: {
      latest: {
        version: '3.0.0',
      },
      current: {
        version: '3.0.0',
      },
    },
  };
  return {
    getState: vi.fn().mockImplementation(() => state),
    setState: vi.fn().mockImplementation((s) => {
      state = { ...state, ...s };
    }),
  };
}

vi.mock('@storybook/core/client-logger');

describe('versions API', () => {
  it('sets initial state with current version', async () => {
    const store = createMockStore();
    const { state } = initVersions({ store });

    expect(state.versions.current).toEqual({ version: '3.0.0' });
  });

  it('sets initial state with latest version', async () => {
    const store = createMockStore();
    const { state } = initVersions({ store });

    expect(state.versions.latest).toEqual({ version: '5.2.3' });
  });

  it('sets initial state with next version', async () => {
    const store = createMockStore();
    const { state } = initVersions({ store });

    expect(state.versions.next).toEqual({ version: '5.3.0-alpha.15' });
  });

  it('sets versions in the init function', async () => {
    const store = createMockStore();
    const { state: initialState, init } = initVersions({
      store,
    });
    store.setState(initialState);
    store.setState.mockReset();

    await init();

    expect(store.setState).toHaveBeenCalledWith({
      versions: {
        latest: { version: '5.2.3' },
        next: { version: '5.3.0-alpha.15' },
        current: { version: '3.0.0' },
      },
    });
  });

  it('getCurrentVersion works', async () => {
    const store = createMockStore();
    const {
      init,
      api,
      state: initialState,
    } = initVersions({
      store,
    });
    store.setState(initialState);

    await init();

    expect(api.getCurrentVersion()).toEqual({
      version: '3.0.0',
    });
  });

  it('getLatestVersion works', async () => {
    const store = createMockStore();
    const {
      init,
      api,
      state: initialState,
    } = initVersions({
      store,
    });
    store.setState(initialState);

    await init();

    expect(api.getLatestVersion()).toMatchObject({
      version: '5.2.3',
    });
  });

  describe('METHOD: getDocsUrl()', () => {
    beforeEach(() => {
      global.STORYBOOK_RENDERER = undefined;
    });

    it('returns the latest url when current version is latest', async () => {
      const store = createMockStore();
      const {
        init,
        api,
        state: initialState,
      } = initVersions({
        store,
      });

      await init();

      store.setState({
        ...initialState,
        versions: {
          ...initialState.versions,
          current: { version: '7.6.1' },
          latest: { version: '7.6.1' },
        },
      });

      expect(api.getDocsUrl({ versioned: true })).toEqual('https://storybook.js.org/docs/');
    });

    it('returns the latest url when version has patch diff with latest', async () => {
      const store = createMockStore();
      const {
        init,
        api,
        state: initialState,
      } = initVersions({
        store,
      });

      await init();

      store.setState({
        ...initialState,
        versions: {
          ...initialState.versions,
          current: { version: '7.6.1' },
          latest: { version: '7.6.10' },
        },
      });

      expect(api.getDocsUrl({ versioned: true })).toEqual('https://storybook.js.org/docs/');
    });

    it('returns the versioned url when current has different docs to latest', async () => {
      const store = createMockStore();
      const {
        init,
        api,
        state: initialState,
      } = initVersions({
        store,
      });

      await init();

      store.setState({
        ...initialState,
        versions: {
          ...initialState.versions,
          current: { version: '7.2.5' },
          latest: { version: '7.6.10' },
        },
      });

      expect(api.getDocsUrl({ versioned: true })).toEqual('https://storybook.js.org/docs/7.2/');
    });

    it('returns the versioned url when current is a prerelease', async () => {
      const store = createMockStore();
      const {
        init,
        api,
        state: initialState,
      } = initVersions({
        store,
      });

      await init();

      store.setState({
        ...initialState,
        versions: {
          ...initialState.versions,
          current: { version: '8.0.0-beta' },
          latest: { version: '7.6.10' },
        },
      });

      expect(api.getDocsUrl({ versioned: true })).toEqual('https://storybook.js.org/docs/8.0/');
    });

    it('returns a Url with a renderer query param when "renderer" is true', async () => {
      const store = createMockStore();
      const {
        init,
        api,
        state: initialState,
      } = initVersions({
        store,
      });
      store.setState({
        ...initialState,
        versions: {
          ...initialState.versions,
          current: { version: '5.2.1' },
          latest: { version: '5.2.1' },
        },
      });

      await init();

      global.STORYBOOK_RENDERER = 'vue';

      expect(api.getDocsUrl({ renderer: true })).toEqual(
        'https://storybook.js.org/docs/?renderer=vue'
      );
    });
  });

  describe('versionUpdateAvailable', () => {
    it('matching version', async () => {
      const store = createMockStore();
      const {
        init,
        api,
        state: initialState,
      } = initVersions({
        store,
      });
      store.setState({
        ...initialState,
        versions: {
          ...initialState.versions,
          current: { version: '5.2.1' },
          latest: { version: '5.2.1' },
        },
      });

      await init();

      expect(api.versionUpdateAvailable()).toEqual(false);
    });

    it('new patch version', async () => {
      const store = createMockStore();
      const {
        init,
        api,
        state: initialState,
      } = initVersions({
        store,
      });
      store.setState({
        ...initialState,
        versions: {
          ...initialState.versions,
          current: { version: '5.2.1' },
          latest: { version: '5.2.2' },
        },
      });

      await init();

      expect(api.versionUpdateAvailable()).toEqual(false);
    });

    it('new minor version', async () => {
      const store = createMockStore();
      const {
        init,
        api,
        state: initialState,
      } = initVersions({
        store,
      });

      await init();

      store.setState({
        ...initialState,
        versions: {
          ...initialState.versions,
          current: { version: '5.2.1' },
          latest: { version: '5.3.1' },
        },
      });

      expect(api.versionUpdateAvailable()).toEqual(true);
    });

    it('new major version', async () => {
      const store = createMockStore();
      const {
        init,
        api,
        state: initialState,
      } = initVersions({
        store,
      });

      await init();

      store.setState({
        ...initialState,
        versions: {
          ...initialState.versions,
          current: { version: '5.2.1' },
          latest: { version: '6.2.1' },
        },
      });

      expect(api.versionUpdateAvailable()).toEqual(true);
    });

    it('new prerelease version', async () => {
      const store = createMockStore();
      const {
        init,
        api,
        state: initialState,
      } = initVersions({
        store,
      });

      await init();

      store.setState({
        ...initialState,
        versions: {
          ...initialState.versions,
          current: { version: '5.2.1' },
          latest: { version: '6.2.1-prerelease.0' },
        },
      });

      expect(api.versionUpdateAvailable()).toEqual(false);
    });

    it('from older prerelease version', async () => {
      const store = createMockStore();
      const { init, api, state: initialState } = initVersions({ store });

      await init();

      store.setState({
        ...initialState,
        versions: {
          ...initialState.versions,
          current: { version: '5.2.1-prerelease.0' },
          latest: { version: '6.2.1' },
        },
      });

      expect(api.versionUpdateAvailable()).toEqual(true);
    });

    it('from newer prerelease version', async () => {
      const store = createMockStore();
      const {
        init,
        api,
        state: initialState,
      } = initVersions({
        store,
      });

      await init();

      store.setState({
        ...initialState,
        versions: {
          ...initialState.versions,
          current: { version: '5.2.1-prerelease.0' },
          latest: { version: '3.2.1' },
        },
      });

      expect(api.versionUpdateAvailable()).toEqual(false);
    });
  });
});
