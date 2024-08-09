import { dirname, join } from 'node:path';

import type { Options, Ref } from '@storybook/core/types';

import { logger } from '@storybook/core/node-logger';

import { readJSON } from '@ndelangen/fs-extra-unified';
import { findUp } from 'find-up';
import resolveFrom from 'resolve-from';

export const getAutoRefs = async (options: Options): Promise<Record<string, Ref>> => {
  const location = await findUp('package.json', { cwd: options.configDir });
  if (!location) {
    return {};
  }
  const directory = dirname(location);

  const { dependencies = [], devDependencies = [] } = (await readJSON(location)) || {};
  const deps = Object.keys({ ...dependencies, ...devDependencies });

  const list = await Promise.all(
    deps.map(async (d) => {
      try {
        const l = resolveFrom(directory, join(d, 'package.json'));

        const { storybook, name, version } = (await readJSON(l)) || {};

        if (storybook?.url) {
          return { id: name, ...storybook, version };
        }
      } catch (error) {
        if ((error as any).code === 'ERR_PACKAGE_PATH_NOT_EXPORTED') {
          // silent warning because user can't do anything about it
          // "package.json" is not part of the package's "exports" field in its package.json
          return undefined;
        }
        logger.warn(`unable to find package.json for ${d}`);
        return undefined;
      }
      return undefined;
    })
  );

  return list.filter(Boolean).reduce(
    (acc, cur) => ({
      ...acc,
      [cur.id]: {
        id: cur.id.toLowerCase(),
        url: stripTrailingSlash(cur.url),
        title: cur.title,
        version: cur.version,
      },
    }),
    {}
  );
};

const checkRef = (url: string) =>
  fetch(`${url}/iframe.html`).then(
    async ({ ok, status }) => {
      if (ok) {
        if (status !== 200) {
          return false;
        }

        // so the status is ok, but if we'd ask for JSON we might get a response saying we need to authenticate.
        const data = await fetch(`${url}/iframe.html`, {
          headers: { Accept: 'application/json' },
        });
        // we might receive non-JSON as a response, because the service ignored our request for JSON response type.
        if (data.ok && (await (data as any).json().catch(() => ({}))).loginUrl) {
          return false;
        }
      }
      return ok;
    },
    () => false
  );

const stripTrailingSlash = (url: string) => url.replace(/\/$/, '');

const toTitle = (input: string) => {
  const result = input
    .replace(/[A-Z]/g, (f) => ` ${f}`)
    .replace(/[-_][A-Z]/gi, (f) => ` ${f.toUpperCase()}`)
    .replace(/-/g, ' ')
    .replace(/_/g, ' ');

  return `${result.substring(0, 1).toUpperCase()}${result.substring(1)}`.trim();
};

export async function getRefs(options: Options) {
  if (options.test) {
    return {};
  }

  const refs = await options.presets.apply<Record<string, Ref>>('refs', await getAutoRefs(options));

  Object.entries(refs).forEach(([key, value]: [string, Ref]) => {
    if (value.disable) {
      // Also delete the ref that is disabled in definedRefs
      delete refs[key];

      return;
    }

    refs[key.toLowerCase()] = {
      ...value,
      id: key.toLowerCase(),
      title: value.title || toTitle(value.id || key),
      url: stripTrailingSlash(value.url),
    };
  });

  // verify the refs are publicly reachable, if they are not we'll require stories.json at runtime, otherwise the ref won't work
  await Promise.all(
    Object.entries(refs).map(async ([k, value]) => {
      const ok = await checkRef(value.url);

      refs[k] = { ...value, type: ok ? 'server-checked' : 'unknown' };
    })
  );

  return refs;
}
