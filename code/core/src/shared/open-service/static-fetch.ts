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

const STATIC_SERVICES_PREFIX = '/services/';

function shouldUseBrowserStaticLoader(): boolean {
  return globalThis.CONFIG_TYPE === 'PRODUCTION';
}

/**
 * Returns a fetch-based loader for static build output, or `undefined` in development.
 *
 * Snapshot paths are logical keys such as `core/docgen/foo.json`, resolved from the Storybook
 * origin (absolute `/services/...` so preview iframes and the manager share the same base).
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
