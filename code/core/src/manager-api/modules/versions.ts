import type { API_UnknownEntries, API_Version, API_Versions } from '@storybook/core/types';
import { global } from '@storybook/global';

import memoize from 'memoizerific';
import semver from 'semver';

import type { ModuleFn } from '../lib/types';
import { version as currentVersion } from '../version';

const { VERSIONCHECK } = global;

export interface SubState {
  versions: API_Versions & API_UnknownEntries;
  lastVersionCheck: number;
  dismissedVersionNotification: undefined | string;
}

const getVersionCheckData = memoize(1)((): API_Versions => {
  try {
    return { ...(JSON.parse(VERSIONCHECK).data || {}) };
  } catch (e) {
    return {};
  }
});

const normalizeRendererName = (renderer: string) => {
  if (renderer.includes('vue')) {
    return 'vue';
  }

  return renderer;
};

export interface SubAPI {
  /**
   * Returns the current version of the Storybook Manager.
   *
   * @returns {API_Version} The current version of the Storybook Manager.
   */
  getCurrentVersion: () => API_Version;
  /**
   * Returns the latest version of the Storybook Manager.
   *
   * @returns {API_Version} The latest version of the Storybook Manager.
   */
  getLatestVersion: () => API_Version;
  /**
   * Returns the URL of the Storybook documentation for the current version.
   *
   * @returns {string} The URL of the Storybook Manager documentation.
   */
  getDocsUrl: (options: { subpath?: string; versioned?: boolean; renderer?: boolean }) => string;
  /**
   * Checks if an update is available for the Storybook Manager.
   *
   * @returns {boolean} True if an update is available, false otherwise.
   */
  versionUpdateAvailable: () => boolean;
}

export const init: ModuleFn = ({ store }) => {
  const { dismissedVersionNotification } = store.getState();

  const state = {
    versions: {
      current: {
        version: currentVersion,
      },
      ...getVersionCheckData(),
    },
    dismissedVersionNotification,
  };

  const api: SubAPI = {
    getCurrentVersion: () => {
      const {
        versions: { current },
      } = store.getState();
      return current as API_Version;
    },
    getLatestVersion: () => {
      const {
        versions: { latest, next, current },
      } = store.getState();
      if (current && semver.prerelease(current.version) && next) {
        return (latest && semver.gt(latest.version, next.version) ? latest : next) as API_Version;
      }
      return latest as API_Version;
    },
    // TODO: Move this to it's own "info" module later
    getDocsUrl: ({ subpath, versioned, renderer }) => {
      const {
        versions: { latest, current },
      } = store.getState();

      let url = 'https://storybook.js.org/docs/';

      if (versioned && current?.version && latest?.version) {
        const versionDiff = semver.diff(latest.version, current.version);
        const isLatestDocs = versionDiff === 'patch' || versionDiff === null;

        if (!isLatestDocs) {
          url += `${semver.major(current.version)}.${semver.minor(current.version)}/`;
        }
      }

      const [cleanedSubpath, hash] = subpath?.split('#') || [];

      if (cleanedSubpath) {
        url += `${cleanedSubpath}/`;
      }

      if (renderer && typeof global.STORYBOOK_RENDERER !== 'undefined') {
        const rendererName = global.STORYBOOK_RENDERER as string;

        if (rendererName) {
          url += `?renderer=${normalizeRendererName(rendererName)}`;
        }
      }

      if (hash) {
        url += `#${hash}`;
      }

      return url;
    },
    versionUpdateAvailable: () => {
      const latest = api.getLatestVersion();
      const current = api.getCurrentVersion();

      if (latest) {
        if (!latest.version) {
          return true;
        }
        if (!current.version) {
          return true;
        }

        const onPrerelease = !!semver.prerelease(current.version);

        const actualCurrent = onPrerelease
          ? `${semver.major(current.version)}.${semver.minor(current.version)}.${semver.patch(
              current.version
            )}`
          : current.version;

        const diff = semver.diff(actualCurrent, latest.version);

        return (
          semver.gt(latest.version, actualCurrent) && diff !== 'patch' && !diff!.includes('pre')
        );
      }
      return false;
    },
  };

  // Grab versions from the server/local storage right away
  const initModule = async () => {
    const { versions = {} } = store.getState();

    const { latest, next } = getVersionCheckData();

    await store.setState({
      versions: { ...versions, latest, next } as API_Versions & API_UnknownEntries,
    });
  };

  return { init: initModule, state, api };
};
