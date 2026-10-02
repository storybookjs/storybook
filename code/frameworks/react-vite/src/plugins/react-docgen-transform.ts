import { existsSync } from 'node:fs';
import { sep } from 'node:path';

import MagicString from 'magic-string';
import type { Documentation, Importer } from 'react-docgen';
import {
  ERROR_CODES,
  builtinHandlers as docgenHandlers,
  builtinResolvers as docgenResolver,
  makeFsImporter,
  parse,
} from 'react-docgen';
import * as TsconfigPaths from 'tsconfig-paths';

import actualNameHandler from './docgen-handlers/actualNameHandler.ts';
import {
  RESOLVE_EXTENSIONS,
  ReactDocgenResolveError,
  defaultLookupModule,
} from './docgen-resolver.ts';

type DocObj = Documentation & { actualName: string; definedInFile: string };

// The `paths` of the tsconfig that owns a file, in a form that can be posted to a worker.
export type TsconfigPathsConfig = {
  configPath: string;
  baseDir: string;
  paths: Record<string, string[]>;
};

// TODO: None of these are able to be overridden, so `default` is aspirational here.
const defaultHandlers = Object.values(docgenHandlers).map((handler) => handler);
const defaultResolver = new docgenResolver.FindExportedDefinitionsResolver();
const handlers = [...defaultHandlers, actualNameHandler];

const matchPathByTsconfigPath = new Map<string, TsconfigPaths.MatchPath>();

export function getMatchPath(tsconfigPaths: TsconfigPathsConfig | undefined) {
  if (!tsconfigPaths) {
    return undefined;
  }
  let matchPath = matchPathByTsconfigPath.get(tsconfigPaths.configPath);
  if (!matchPath) {
    matchPath = TsconfigPaths.createMatchPath(tsconfigPaths.baseDir, tsconfigPaths.paths, [
      'browser',
      'module',
      'main',
    ]);
    matchPathByTsconfigPath.set(tsconfigPaths.configPath, matchPath);
  }
  return matchPath;
}

// Appends `__docgenInfo` for the components defined in `src`. Returns `undefined` when react-docgen
// finds no component, and throws for any other react-docgen error.
export function transformWithReactDocgen(
  src: string,
  id: string,
  tsconfigPaths: TsconfigPathsConfig | undefined,
  importer: Importer = getReactDocgenImporter(getMatchPath(tsconfigPaths))
) {
  try {
    const docgenResults = parse(src, {
      resolver: defaultResolver,
      handlers,
      importer,
      filename: id,
    }) as DocObj[];
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
      return undefined;
    }
    throw e;
  }
}

export function getReactDocgenImporter(matchPath: TsconfigPaths.MatchPath | undefined) {
  return makeFsImporter((filename, basedir) => {
    const mappedFilenameByPaths = (() => {
      if (matchPath) {
        const match = matchPath(filename);
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
  });
}
