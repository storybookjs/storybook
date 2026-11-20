import { existsSync } from 'node:fs';
import { dirname, extname, normalize, relative, sep } from 'node:path';

import { findTsconfigPathForFile, getTsconfigPathsBaseDir } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import { createFilter } from '@rollup/pluginutils';
import MagicString from 'magic-string';
import type { Documentation } from 'react-docgen';
import {
  ERROR_CODES,
  builtinHandlers as docgenHandlers,
  builtinResolvers as docgenResolver,
  makeFsImporter,
  parse,
} from 'react-docgen';
import * as TsconfigPaths from 'tsconfig-paths';
import type { PluginOption } from 'vite';

import actualNameHandler from './docgen-handlers/actualNameHandler.ts';
import {
  RESOLVE_EXTENSIONS,
  ReactDocgenResolveError,
  defaultLookupModule,
} from './docgen-resolver.ts';

type DocObj = Documentation & { actualName: string; definedInFile: string };

// TODO: None of these are able to be overridden, so `default` is aspirational here.
const defaultHandlers = Object.values(docgenHandlers).map((handler) => handler);
const defaultResolver = new docgenResolver.FindExportedDefinitionsResolver();
const handlers = [...defaultHandlers, actualNameHandler];

type Options = {
  include?: string | RegExp | (string | RegExp)[];
  exclude?: string | RegExp | (string | RegExp)[];
};

type ImporterCacheOptions = NonNullable<Parameters<typeof makeFsImporter>[1]>;

class ResolveCache extends Map<string, string | null> {
  #onResolvedFile: ((filename: string) => void) | undefined;

  override get(key: string) {
    const resolvedFile = super.get(key);
    if (resolvedFile) {
      this.#onResolvedFile?.(resolvedFile);
    }
    return resolvedFile;
  }

  override set(key: string, resolvedFile: string | null) {
    if (resolvedFile) {
      this.#onResolvedFile?.(resolvedFile);
    }
    return super.set(key, resolvedFile);
  }

  withWatchFile<T>(onResolvedFile: (filename: string) => void, callback: () => T) {
    this.#onResolvedFile = onResolvedFile;
    try {
      return callback();
    } finally {
      this.#onResolvedFile = undefined;
    }
  }
}

export async function reactDocgen({
  include = /\.(mjs|tsx?|jsx?)$/,
  exclude = [/node_modules\/.*/],
}: Options = {}): Promise<PluginOption> {
  const cwd = process.cwd();
  const filter = createFilter(include, exclude);
  const parseCache: NonNullable<ImporterCacheOptions['parseCache']> = new Map();
  const resolveCaches = new Map<TsconfigPaths.MatchPath | undefined, ResolveCache>();

  return {
    name: 'storybook:react-docgen-plugin',
    enforce: 'pre',
    async transform(src: string, id: string) {
      if (!filter(relative(cwd, id))) {
        return;
      }

      try {
        const { matchPath, tsconfigPath } = createTsconfigMatchPath(id);
        if (tsconfigPath) {
          this.addWatchFile(tsconfigPath);
        }
        const resolveCache = resolveCaches.get(matchPath) ?? new ResolveCache();
        resolveCaches.set(matchPath, resolveCache);
        const docgenResults = resolveCache.withWatchFile(
          (filename) => this.addWatchFile(filename),
          () => parseDocgen(src, id, matchPath, { parseCache, resolveCache })
        );
        const s = new MagicString(src);

        docgenResults.forEach((info) => {
          const { actualName, definedInFile, ...docgenInfo } = info;
          if (actualName && definedInFile == id) {
            const docNode = JSON.stringify(docgenInfo);
            s.append(`;${actualName}.__docgenInfo=${docNode}`);
          }
        });

        return {
          code: s.toString(),
          map: s.generateMap({ hires: true, source: id }).toString(),
        };
      } catch (e: any) {
        // Ignore the error when react-docgen cannot find a react component
        if (e.code === ERROR_CODES.MISSING_DEFINITION) {
          return;
        }
        throw e;
      }
    },
    watchChange(id, change) {
      const normalizedId = normalize(id);
      parseCache.delete(normalizedId);

      if (change.event === 'create' || change.event === 'delete') {
        resolveCaches.forEach((cache) => cache.clear());
      }

      if (extname(normalizedId) === '.json') {
        matchPathByTsconfigPath.clear();
        resolveCaches.clear();
      }
    },
  };
}

/**
 * Parses with react-docgen's own Babel parser settings first, so a project Babel config that cannot
 * parse the file (e.g. a StyleX-only `babel.config.*` without a TypeScript preset) does not break
 * docgen. If that fails, retries once with the project Babel config, which keeps configs that add
 * parser syntax react-docgen lacks working. If both fail, the first error is thrown.
 */
type ImporterCaches = {
  parseCache: NonNullable<ImporterCacheOptions['parseCache']>;
  resolveCache: ResolveCache;
};

function parseDocgen(
  src: string,
  id: string,
  matchPath: TsconfigPaths.MatchPath | undefined,
  caches?: ImporterCaches
) {
  const options = {
    resolver: defaultResolver,
    handlers,
    importer: getReactDocgenImporter(matchPath, caches),
    filename: id,
  };

  try {
    return parse(src, {
      ...options,
      babelOptions: { babelrc: false, configFile: false },
    }) as DocObj[];
  } catch (isolatedError: any) {
    if (isolatedError.code === ERROR_CODES.MISSING_DEFINITION) {
      throw isolatedError;
    }
    try {
      return parse(src, options) as DocObj[];
    } catch (projectConfigError: any) {
      if (projectConfigError.code === ERROR_CODES.MISSING_DEFINITION) {
        throw projectConfigError;
      }
      logger.debug(
        `react-docgen also failed with the project Babel config for ${id}: ${projectConfigError}`
      );
      throw isolatedError;
    }
  }
}

export function getReactDocgenImporter(
  matchPath: TsconfigPaths.MatchPath | undefined,
  caches?: ImporterCaches
) {
  return makeFsImporter(
    (filename, basedir) => {
      const mappedFilenameByPaths = (() => {
        if (matchPath) {
          // Without extensions, tsconfig-paths only tries `.js`, `.json` and `.node`, so an alias to a
          // TypeScript file such as `@/components/types` would never match.
          const match = matchPath(filename, undefined, undefined, RESOLVE_EXTENSIONS);
          return match || filename;
        } else {
          return filename;
        }
      })();

      const result = defaultLookupModule(mappedFilenameByPaths, basedir);

      if (result.includes(`${sep}react-native${sep}index.js`)) {
        const replaced = result.replace(
          `${sep}react-native${sep}index.js`,
          `${sep}react-native-web${sep}dist${sep}index.js`
        );
        if (existsSync(replaced)) {
          if (RESOLVE_EXTENSIONS.find((ext) => result.endsWith(ext))) {
            return replaced;
          }
        }
      }
      if (RESOLVE_EXTENSIONS.find((ext) => result.endsWith(ext))) {
        return result;
      }

      throw new ReactDocgenResolveError(filename);
    },
    caches && { parseCache: caches.parseCache, resolveCache: caches.resolveCache }
  );
}

const matchPathByTsconfigPath = new Map<string, TsconfigPaths.MatchPath>();

function createTsconfigMatchPath(filePath: string) {
  const tsconfigPath = findTsconfigPathForFile(dirname(filePath), filePath);
  if (!tsconfigPath) {
    return { matchPath: undefined };
  }

  const cached = matchPathByTsconfigPath.get(tsconfigPath);
  if (cached) {
    return { matchPath: cached, tsconfigPath };
  }

  const tsconfig = TsconfigPaths.loadConfig(tsconfigPath);

  if (tsconfig.resultType !== 'success') {
    return { matchPath: undefined, tsconfigPath };
  }

  logger.debug('Using tsconfig paths for react-docgen');
  const matchPath = TsconfigPaths.createMatchPath(
    getTsconfigPathsBaseDir(tsconfig.configFileAbsolutePath),
    tsconfig.paths,
    ['browser', 'module', 'main']
  );
  matchPathByTsconfigPath.set(tsconfigPath, matchPath);
  return { matchPath, tsconfigPath };
}
