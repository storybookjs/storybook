import type { API_UnknownEntries, API_Version, API_Versions } from 'storybook/internal/types';

import { global } from '@storybook/global';

import memoize from 'memoizerific';
// Per-function imports keep the rest of semver out of the browser bundle.
import diff from 'semver/functions/diff.js';
import gt from 'semver/functions/gt.js';
import major from 'semver/functions/major.js';
import minor from 'semver/functions/minor.js';
import patch from 'semver/functions/patch.js';
import prerelease from 'semver/functions/prerelease.js';

import type { ModuleFn } from '../lib/types.tsx';
import { version as currentVersion } from '../version.ts';

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
   * @param options - The options for the documentation URL.
   * @param options.asset - Like subpath, but links to the docs-assets directory.
   * @param options.subpath - The subpath of the documentation URL.
   * @param options.versioned - Whether to include the versioned path.
   * @param options.renderer - Whether to include the renderer path.
   * @param options.ref - Tracking reference for the docs site. E.g. 'ui', 'error', 'upgrade', etc.
   * @returns {string} The URL of the Storybook Manager documentation.
   */
  getDocsUrl: (options: {
    asset?: string;
    subpath?: string;
    versioned?: boolean;
    renderer?: boolean;
    ref?: string;
  }) => string;
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
      if (current && prerelease(current.version) && next) {
        return (latest && gt(latest.version, next.version) ? latest : next) as API_Version;
      }
      return latest as API_Version;
    },
    // TODO: Move this to it's own "info" module later
    getDocsUrl: ({ asset, subpath = asset, versioned, renderer, ref = 'ui' }) => {
      const { versions } = store.getState();
      const latestVersion = versions.latest?.version;
      const currentVersion = versions.current?.version;
      const activeVersion =
        (currentVersion?.startsWith('0.0.0') && latestVersion) || currentVersion;

      let url = `https://storybook.js.org/${asset ? 'docs-assets' : 'docs'}/`;

      if (asset && activeVersion) {
        url += `${major(activeVersion)}.${minor(activeVersion)}/`;
      } else if (versioned && activeVersion && latestVersion) {
        const versionDiff = diff(latestVersion, activeVersion);
        const isLatestDocs = versionDiff === 'patch' || versionDiff === null;

        if (!isLatestDocs) {
          url += `${major(activeVersion)}.${minor(activeVersion)}/`;
        }
      }

      const [cleanedSubpath, hash] = subpath?.split('#') || [];

      if (cleanedSubpath) {
        url += asset ? cleanedSubpath : `${cleanedSubpath}/`;
      }

      if (renderer && typeof global.STORYBOOK_RENDERER !== 'undefined') {
        const rendererName = global.STORYBOOK_RENDERER as string;

        if (rendererName) {
          url += `?renderer=${normalizeRendererName(rendererName)}`;
        }
      }

      if (ref) {
        url += `${url.includes('?') ? '&' : '?'}ref=${ref}`;
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

        const onPrerelease = !!prerelease(current.version);

        const actualCurrent = onPrerelease
          ? `${major(current.version)}.${minor(current.version)}.${patch(current.version)}`
          : current.version;

        const releaseDiff = diff(actualCurrent, latest.version);

        return (
          gt(latest.version, actualCurrent) &&
          releaseDiff !== 'patch' &&
          !releaseDiff!.includes('pre')
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
