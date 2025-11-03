import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
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

const getReactDocgenCache = new Map<string, ReturnType<typeof getReactDocgen>>();

export function invalidateCache() {
  getReactDocgenCache.clear();
  getTsConfigCache.clear();
}

const getTsConfigCache = new Map<string, TsconfigPaths.ConfigLoaderResult>();

export function getTsConfig(cwd: string) {
  const cached = getTsConfigCache.get(cwd);
  if (cached) {
    return cached;
  }
  const tsconfigPath = find.up('tsconfig.json', { cwd: process.cwd(), last: getProjectRoot() });
  return TsconfigPaths.loadConfig(tsconfigPath);
}

export async function getReactDocgen(
  path: string,
  importName?: string
): Promise<
  { type: 'success'; data: DocObj } | { type: 'error'; error: { name: string; message: string } }
> {
  const key = JSON.stringify({ path, importName });
  const cached = getReactDocgenCache.get(key);
  if (cached) {
    return cached;
  }

  let code;
  try {
    code = await readFile(path, 'utf-8');
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
    docgens = parse(code, {
      resolver: defaultResolver,
      handlers,
      importer: getReactDocgenImporter(),
      filename: path,
    }) as DocObj[];
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
}

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
