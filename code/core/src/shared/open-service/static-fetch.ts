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

const STATIC_SERVICES_PREFIX = '/services/';

/**
 * Whether this runtime should fetch prebuilt static snapshots instead of running authored `load`
 * hooks.
 *
 * Only static Storybook builds inject `CONFIG_TYPE = 'PRODUCTION'` into the browser bundles; the
 * dev server and the Node static-build pipeline leave it undefined, so they keep running real loads.
 */
export function shouldUseBrowserStaticLoader(): boolean {
  return globalThis.CONFIG_TYPE === 'PRODUCTION';
}

/**
 * Fetches one prebuilt open-service static snapshot from the served build output.
 *
 * Snapshot paths are logical keys such as `core/docgen/foo.json`, resolved from the Storybook
 * origin (absolute `/services/...` so preview iframes and the manager share the same base). Callers
 * gate this on {@link shouldUseBrowserStaticLoader}; in development the runtime runs the authored
 * `load` hook against the live server instead.
 */
export async function fetchStaticSnapshot(
  logicalPath: string,
  context: StaticLoaderContext
): Promise<Record<string, unknown>> {
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
}
