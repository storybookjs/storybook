import { beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('storybook/internal/client-logger');

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

vi.mock('storybook/internal/client-logger');

const latest = {
  current: { version: '7.6.1' },
  latest: { version: '7.6.1' },
};
const patchDiff = {
  current: { version: '7.6.1' },
  latest: { version: '7.6.10' },
};
const minorDiff = {
  current: { version: '7.2.5' },
  latest: { version: '7.6.10' },
};
const majorDiff = {
  current: { version: '6.2.1' },
  latest: { version: '7.6.10' },
};
const newerPrerelease = {
  current: { version: '8.0.0-beta' },
  latest: { version: '7.6.10' },
};
const olderPrerelease = {
  current: { version: '5.2.1-prerelease.0' },
  latest: { version: '6.2.1' },
};
const prereleaseAvailable = {
  current: { version: '5.2.1' },
  latest: { version: '6.2.1-prerelease.0' },
};

const setVersions = (store, state, versions) =>
  store.setState({ ...state, versions: { ...state.versions, ...versions } });

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
    const { state: initialState, init } = initVersions({ store });

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
    const { init, api, state: initialState } = initVersions({ store });

    store.setState(initialState);

    await init();

    expect(api.getCurrentVersion()).toEqual({
      version: '3.0.0',
    });
  });

  it('getLatestVersion works', async () => {
    const store = createMockStore();
    const { init, api, state: initialState } = initVersions({ store });

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
      const { init, api, state: initialState } = initVersions({ store });

      await init();

      setVersions(store, initialState, latest);

      expect(api.getDocsUrl({ versioned: true })).toEqual('https://storybook.js.org/docs/?ref=ui');
    });

    it('returns the latest url when version has patch diff with latest', async () => {
      const store = createMockStore();
      const { init, api, state: initialState } = initVersions({ store });

      await init();

      setVersions(store, initialState, patchDiff);

      expect(api.getDocsUrl({ versioned: true })).toEqual('https://storybook.js.org/docs/?ref=ui');
    });

    it('returns the versioned url when current has different docs to latest', async () => {
      const store = createMockStore();
      const { init, api, state: initialState } = initVersions({ store });

      await init();

      setVersions(store, initialState, minorDiff);

      expect(api.getDocsUrl({ versioned: true })).toEqual(
        'https://storybook.js.org/docs/7.2/?ref=ui'
      );
    });

    it('returns the versioned url when current is a prerelease', async () => {
      const store = createMockStore();
      const { init, api, state: initialState } = initVersions({ store });

      await init();

      setVersions(store, initialState, newerPrerelease);

      expect(api.getDocsUrl({ versioned: true })).toEqual(
        'https://storybook.js.org/docs/8.0/?ref=ui'
      );
    });

    it('returns a url with a renderer query param when "renderer" is true', async () => {
      const store = createMockStore();
      const { init, api, state: initialState } = initVersions({ store });

      setVersions(store, initialState, latest);

      await init();

      global.STORYBOOK_RENDERER = 'vue';

      expect(api.getDocsUrl({ renderer: true })).toEqual(
        'https://storybook.js.org/docs/?renderer=vue&ref=ui'
      );
    });

    it('returns a url with a custom ref query param when provided', async () => {
      const store = createMockStore();
      const { init, api, state: initialState } = initVersions({ store });

      await init();

      setVersions(store, initialState, latest);

      expect(api.getDocsUrl({ ref: 'custom' })).toEqual(
        'https://storybook.js.org/docs/?ref=custom'
      );
    });

    it('returns a url without ref query param when empty', async () => {
      const store = createMockStore();
      const { init, api, state: initialState } = initVersions({ store });

      await init();

      setVersions(store, initialState, latest);

      expect(api.getDocsUrl({ ref: '' })).toEqual('https://storybook.js.org/docs/');
    });

    it('returns a versioned url with assets path when provided', async () => {
      const store = createMockStore();
      const { init, api, state: initialState } = initVersions({ store });

      await init();

      setVersions(store, initialState, latest);

      expect(api.getDocsUrl({ asset: 'api/doc-block-controls.png' })).toEqual(
        'https://storybook.js.org/docs-assets/7.6/api/doc-block-controls.png?ref=ui'
      );
    });
  });

  describe('versionUpdateAvailable', () => {
    it('matching version', async () => {
      const store = createMockStore();
      const { init, api, state: initialState } = initVersions({ store });

      setVersions(store, initialState, latest);

      await init();

      expect(api.versionUpdateAvailable()).toEqual(false);
    });

    it('new patch version', async () => {
      const store = createMockStore();
      const { init, api, state: initialState } = initVersions({ store });

      setVersions(store, initialState, patchDiff);

      await init();

      expect(api.versionUpdateAvailable()).toEqual(false);
    });

    it('new minor version', async () => {
      const store = createMockStore();
      const { init, api, state: initialState } = initVersions({ store });

      await init();

      setVersions(store, initialState, minorDiff);

      expect(api.versionUpdateAvailable()).toEqual(true);
    });

    it('new major version', async () => {
      const store = createMockStore();
      const { init, api, state: initialState } = initVersions({ store });

      await init();

      setVersions(store, initialState, majorDiff);

      expect(api.versionUpdateAvailable()).toEqual(true);
    });

    it('new prerelease version', async () => {
      const store = createMockStore();
      const { init, api, state: initialState } = initVersions({ store });

      await init();

      setVersions(store, initialState, prereleaseAvailable);

      expect(api.versionUpdateAvailable()).toEqual(false);
    });

    it('from older prerelease version', async () => {
      const store = createMockStore();
      const { init, api, state: initialState } = initVersions({ store });

      await init();

      setVersions(store, initialState, olderPrerelease);

      expect(api.versionUpdateAvailable()).toEqual(true);
    });

    it('from newer prerelease version', async () => {
      const store = createMockStore();
      const { init, api, state: initialState } = initVersions({ store });

      await init();

      setVersions(store, initialState, newerPrerelease);

      expect(api.versionUpdateAvailable()).toEqual(false);
    });
  });
});
