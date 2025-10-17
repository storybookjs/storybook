import { existsSync } from 'node:fs';
import { sep } from 'node:path';

import { types as t } from 'storybook/internal/babel';
import { getProjectRoot } from 'storybook/internal/common';
import { type CsfFile } from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';

import * as find from 'empathic/find';
import type { Documentation } from 'react-docgen';
import {
  builtinHandlers as docgenHandlers,
  builtinResolvers as docgenResolver,
  makeFsImporter,
  parse,
} from 'react-docgen';
import * as TsconfigPaths from 'tsconfig-paths';

import actualNameHandler from './reactDocgen/actualNameHandler';
import {
  RESOLVE_EXTENSIONS,
  ReactDocgenResolveError,
  defaultLookupModule,
} from './reactDocgen/docgenResolver';
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

export function getMatchingDocgen(docgens: DocObj[], csf: CsfFile) {
  const componentName = csf._meta?.component;
  if (docgens.length === 1) {
    return docgens[0];
  }
  const importSpecifier = csf._componentImportSpecifier;

  let importName: string;
  if (t.isImportSpecifier(importSpecifier)) {
    const imported = importSpecifier.imported;
    importName = t.isIdentifier(imported) ? imported.name : imported.value;
  } else if (t.isImportDefaultSpecifier(importSpecifier)) {
    importName = 'default';
  }

  const docgen = docgens.find((docgen) => docgen.exportName === importName);
  if (docgen || !componentName) {
    return docgen;
  }
  return docgens.find(
    (docgen) => docgen.displayName === componentName || docgen.actualName === componentName
  );
}

export async function parseWithReactDocgen({ code, filename }: { code: string; filename: string }) {
  const tsconfigPath = find.up('tsconfig.json', { cwd: process.cwd(), last: getProjectRoot() });
  const tsconfig = TsconfigPaths.loadConfig(tsconfigPath);

  let matchPath: TsconfigPaths.MatchPath | undefined;

  if (tsconfig.resultType === 'success') {
    logger.info('Using tsconfig paths for react-docgen');
    matchPath = TsconfigPaths.createMatchPath(tsconfig.absoluteBaseUrl, tsconfig.paths, [
      'browser',
      'module',
      'main',
    ]);
  }

  try {
    return parse(code, {
      resolver: defaultResolver,
      handlers,
      importer: getReactDocgenImporter(matchPath),
      filename,
    }) as DocObj[];
  } catch (e) {
    console.error(e);
    return [];
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
