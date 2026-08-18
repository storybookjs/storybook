/**
 * Browser-side loader for prebuilt open-service static snapshots.
 *
 * Active in static Storybook builds. In the dev server, the runtime runs query `load` hooks against
 * the live server instead.
 */

import {
  OpenServiceStaticSnapshotInvalidError,
  OpenServiceStaticSnapshotLoadError,
} from '../../manager-errors.ts';
import type { ServiceId } from './types.ts';

export type StaticLoaderContext = {
  serviceId: ServiceId;
  queryName: string;
  input: unknown;
};

export type StaticLoader = (
  logicalPath: string,
  context: StaticLoaderContext
) => Promise<Record<string, unknown>>;

// Document-relative, like `STORY_INDEX_PATH`: the manager and the preview iframe are siblings in
// the build output, so both resolve this against the directory Storybook was deployed into. An
// origin-absolute prefix would resolve against the origin root instead, which is the wrong place
// whenever Storybook is not deployed at it (a GitHub Pages project site, for one).
const STATIC_SERVICES_PREFIX = './services/';

function shouldUseBrowserStaticLoader(): boolean {
  return globalThis.CONFIG_TYPE === 'PRODUCTION';
}

/**
 * Returns a fetch-based loader for static build output, or `undefined` in development.
 *
 * Snapshot paths are logical keys such as `core/docgen/foo.json`, resolved relative to the
 * document (`./services/...`), so the manager and preview iframes share the same base wherever
 * the build is deployed.
 */
export function createBrowserStaticLoader(): StaticLoader | undefined {
  if (!shouldUseBrowserStaticLoader()) {
    return undefined;
  }

  return async (logicalPath, context) => {
    const url = `${STATIC_SERVICES_PREFIX}${logicalPath}`;
    let res: Response;

    try {
      res = await fetch(url);
    } catch (cause) {
      throw new OpenServiceStaticSnapshotLoadError({ ...context, logicalPath, url, cause });
    }

    if (!res.ok) {
      const cause = { status: res.status, statusText: res.statusText };
      throw new OpenServiceStaticSnapshotLoadError({
        ...context,
        logicalPath,
        url,
        cause,
        status: res.status,
        statusText: res.statusText,
      });
    }

    let snapshot: unknown;
    try {
      snapshot = await res.json();
    } catch (cause) {
      throw new OpenServiceStaticSnapshotLoadError({ ...context, logicalPath, url, cause });
    }

    if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
      return snapshot as Record<string, unknown>;
    }

    throw new OpenServiceStaticSnapshotInvalidError({
      ...context,
      logicalPath,
      url,
      received: snapshot,
    });
  };
}
