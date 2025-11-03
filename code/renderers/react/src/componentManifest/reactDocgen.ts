import { existsSync, readFileSync } from 'node:fs';
import { sep } from 'node:path';

import { getProjectRoot, resolveImport, supportedExtensions } from 'storybook/internal/common';

import * as find from 'empathic/find';
import {
  type Documentation,
  ERROR_CODES,
  builtinHandlers as docgenHandlers,
  builtinResolvers as docgenResolver,
  makeFsImporter,
  parse,
} from 'react-docgen';
import * as TsconfigPaths from 'tsconfig-paths';

import { extractJSDocInfo } from './jsdocTags';
import actualNameHandler from './reactDocgen/actualNameHandler';
import { ReactDocgenResolveError } from './reactDocgen/docgenResolver';
import exportNameHandler from './reactDocgen/exportNameHandler';
import { cached, cachedReadFileSync } from './utils';

export type DocObj = Documentation & {
  actualName: string;
  definedInFile: string;
  exportName?: string;
};

// TODO: None of these are able to be overridden, so `default` is aspirational here.
const defaultHandlers = Object.values(docgenHandlers).map((handler) => handler);
const defaultResolver = new docgenResolver.FindExportedDefinitionsResolver();
const handlers = [...defaultHandlers, actualNameHandler, exportNameHandler];

export function getMatchingDocgen(docgens: DocObj[], importName?: string) {
  if (docgens.length === 1) {
    return docgens[0];
  }

  return importName
    ? (docgens.find((docgen) => docgen.exportName === importName) ??
        docgens.find(
          (docgen) => docgen.displayName === importName || docgen.actualName === importName
        ))
    : docgens[0];
}

export function matchPath(id: string) {
  const tsconfig = getTsConfig(process.cwd());

  if (tsconfig.resultType === 'success') {
    const match = TsconfigPaths.createMatchPath(tsconfig.absoluteBaseUrl, tsconfig.paths, [
      'browser',
      'module',
      'main',
    ]);
    return match(id, undefined, undefined, supportedExtensions) ?? id;
  }
  return id;
}

export const getTsConfig = cached(
  (cwd: string) => {
    const tsconfigPath = find.up('tsconfig.json', { cwd, last: getProjectRoot() });
    return TsconfigPaths.loadConfig(tsconfigPath);
  },
  { name: 'getTsConfig' }
);

export const parseWithReactDocgen = cached(
  (code: string, path: string) => {
    return parse(code, {
      resolver: defaultResolver,
      handlers,
      importer: getReactDocgenImporter(),
      filename: path,
    }) as DocObj[];
  },
  { key: (code, path) => path, name: 'parseWithReactDocgen' }
);

export const getReactDocgen = cached(
  (
    path: string,
    importName?: string
  ):
    | { type: 'success'; data: DocObj }
    | { type: 'error'; error: { name: string; message: string } } => {
    let code;
    if (path.includes('node_modules')) {
      return {
        type: 'error',
        error: {
          name: 'Component file in node_modules',
          message: `Component files in node_modules are not supported. Please import your component file directly.`,
        },
      };
    }
    try {
      code = cachedReadFileSync(path, 'utf-8') as string;
    } catch (_) {
      return {
        type: 'error',
        error: {
          name: 'Component file could not be read',
          message: `Could not read the component file located at "${path}".`,
        },
      };
    }

    const noCompDefError = {
      type: 'error' as const,
      error: {
        name: 'No component definition found',
        message:
          `Could not find a component definition for the component file located at:\n` +
          `${path}\n` +
          `Avoid barrel files when importing your component file.\n` +
          `Prefer relative imports if possible.\n` +
          `Avoid pointing to transpiled files.\n` +
          `You can debug your component file in this playground: https://react-docgen.dev/playground`,
      },
    };

    let docgens;
    try {
      docgens = parseWithReactDocgen(code, path);
    } catch (e) {
      if (e instanceof Error && 'code' in e && e.code === ERROR_CODES.MISSING_DEFINITION) {
        return noCompDefError;
      }
      return {
        type: 'error',
        error: {
          name: 'Docgen evaluation failed',
          message: e instanceof Error ? `${e.message}\n` : '',
        },
      };
    }
    const docgen = getMatchingDocgen(docgens, importName);
    if (!docgen) {
      return noCompDefError;
    }
    return { type: 'success', data: docgen };
  },
  { name: 'getReactDocgen' }
);

export function getReactDocgenImporter() {
  return makeFsImporter((filename, basedir) => {
    const mappedFilenameByPaths = (() => {
      return matchPath(filename);
    })();

    const result = resolveImport(mappedFilenameByPaths, { basedir });

    if (result.includes(`${sep}react-native${sep}index.js`)) {
      const replaced = result.replace(
        `${sep}react-native${sep}index.js`,
        `${sep}react-native-web${sep}dist${sep}index.js`
      );
      if (existsSync(replaced)) {
        if (supportedExtensions.find((ext) => result.endsWith(ext))) {
          return replaced;
        }
      }
    }
    if (supportedExtensions.find((ext) => result.endsWith(ext))) {
      return result;
    }

    throw new ReactDocgenResolveError(filename);
  });
}

export function getImportTag(docgen: DocObj) {
  const jsdocComment = docgen?.description;
  const tags = jsdocComment ? extractJSDocInfo(jsdocComment).tags : undefined;
  return tags?.import?.[0];
}
