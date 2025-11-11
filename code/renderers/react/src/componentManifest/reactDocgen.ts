import { existsSync } from 'node:fs';
import { dirname, sep } from 'node:path';

import { babelParse, types as t } from 'storybook/internal/babel';
import { getProjectRoot, supportedExtensions } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import * as find from 'empathic/find';
import {
  type Documentation,
  builtinHandlers as docgenHandlers,
  builtinResolvers as docgenResolver,
  makeFsImporter,
  parse,
} from 'react-docgen';
import { dedent } from 'ts-dedent';
import * as TsconfigPaths from 'tsconfig-paths';

import { type ComponentRef } from './getComponentImports';
import { extractJSDocInfo } from './jsdocTags';
import actualNameHandler from './reactDocgen/actualNameHandler';
import { ReactDocgenResolveError } from './reactDocgen/docgenResolver';
import exportNameHandler from './reactDocgen/exportNameHandler';
import { cached, cachedReadFileSync, cachedResolveImport } from './utils';

export type DocObj = Documentation & {
  actualName: string;
  definedInFile: string;
  exportName?: string;
};

// TODO: None of these are able to be overridden, so `default` is aspirational here.
const defaultHandlers = Object.values(docgenHandlers).map((handler) => handler);
const defaultResolver = new docgenResolver.FindExportedDefinitionsResolver();
const handlers = [...defaultHandlers, actualNameHandler, exportNameHandler];

export function getMatchingDocgen(docgens: DocObj[], component: ComponentRef) {
  if (docgens.length === 0) {
    return;
  }
  if (docgens.length === 1) {
    return docgens[0];
  }

  const matchingDocgen =
    docgens.find((docgen) =>
      [component.importName, component.localImportName].includes(docgen.exportName)
    ) ??
    docgens.find(
      (docgen) =>
        [component.importName, component.localImportName, component.componentName].includes(
          docgen.displayName
        ) ||
        [component.importName, component.localImportName, component.componentName].includes(
          docgen.actualName
        )
    );

  return matchingDocgen ?? docgens[0];
}

export function matchPath(id: string, basedir?: string) {
  basedir ??= process.cwd();
  const tsconfig = getTsConfig(basedir);

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

const getExportPaths = cached(
  (code: string, filePath: string) => {
    let ast;
    try {
      ast = babelParse(code);
    } catch {
      return [];
    }

    const basedir = dirname(filePath);
    const body = ast.program.body;
    return body
      .flatMap((statement) =>
        t.isExportAllDeclaration(statement)
          ? [statement.source.value]
          : t.isExportNamedDeclaration(statement) && !!statement.source && !statement.declaration
            ? [statement.source.value]
            : []
      )
      .map((id) => matchPath(id, basedir))
      .flatMap((id) => {
        try {
          return [cachedResolveImport(id, { basedir })];
        } catch (e) {
          logger.debug(e);
          return [];
        }
      });
  },
  { name: 'getExportPaths' }
);

const gatherDocgensForPath = cached(
  (
    path: string,
    depth: number
  ): {
    docgens: DocObj[];
    errors: { path: string; code: string; name: string; message: string }[];
  } => {
    if (path.includes('node_modules')) {
      return {
        docgens: [],
        errors: [
          {
            path,
            code: '/* File in node_modules */',
            name: 'Component file in node_modules',
            message: dedent`
              Component files in node_modules are not supported.
              The distributed files in node_modules usually don't contain the necessary comments or types needed to analyze component information.
              Configure TypeScript path aliases to map your package name to the source file instead.

              Example (tsconfig.json):
              {
                "compilerOptions": {
                  "baseUrl": ".",
                  "paths": {
                    "@design-system/button": ["src/components/Button.tsx"],
                    "@design-system/*": ["src/components/*"]
                  }
                }
              }

              Then import using:
              import { Button } from '@design-system/button'

              Storybook resolves tsconfig paths automatically.
            `,
          },
        ],
      };
    }

    let code;
    try {
      code = cachedReadFileSync(path, 'utf-8') as string;
    } catch {
      return {
        docgens: [],
        errors: [
          {
            path,
            code: '/* File not found or unreadable */',
            name: 'Component file could not be read',
            message: `Could not read the component file located at "${path}".\nPrefer relative imports if possible.`,
          },
        ],
      };
    }

    if (depth > 5) {
      return {
        docgens: [],
        errors: [
          {
            path,
            code,
            name: 'Max re-export depth exceeded',
            message: dedent`
              Traversal stopped after 5 steps while following re-exports starting from this file.
              This usually indicates a deep or circular re-export chain. Try one of the following:
              - Import the component file directly (e.g., src/components/Button.tsx),
              - Reduce the number of re-export hops.
            `,
          },
        ],
      };
    }

    const exportPaths = getExportPaths(code, path).map((p) => gatherDocgensForPath(p, depth + 1));
    const docgens = exportPaths.flatMap((r) => r.docgens);
    const errors = exportPaths.flatMap((r) => r.errors);

    try {
      return {
        docgens: [...parseWithReactDocgen(code, path), ...docgens],
        errors,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        docgens,
        errors: [
          {
            path,
            code,
            name: 'No component definition found',
            message: dedent`
              ${message}
              You can debug your component file in this playground: https://react-docgen.dev/playground
            `,
          },
          ...errors,
        ],
      };
    }
  },
  { name: 'gatherDocgensWithTrace', key: (filePath) => filePath }
);

export const getReactDocgen = cached(
  (
    path: string,
    component: ComponentRef
  ):
    | { type: 'success'; data: DocObj }
    | { type: 'error'; error: { name: string; message: string } } => {
    const { docgens, errors } = gatherDocgensForPath(path, 0);

    const docgen = getMatchingDocgen(docgens, component);

    if (!docgen) {
      const error = {
        name: errors.at(-1)?.name ?? 'No component definition found',
        message: errors
          .map(
            (e) => dedent`
            File: ${e.path}
            Error:
            ${e.message}
            Code:
            ${e.code}`
          )
          .join('\n\n'),
      };
      return { type: 'error', error };
    }
    return { type: 'success', data: docgen };
  },
  { name: 'getReactDocgen', key: (path, component) => path + JSON.stringify(component) }
);

export function getReactDocgenImporter() {
  return makeFsImporter((filename, basedir) => {
    const mappedFilenameByPaths = (() => {
      return matchPath(filename, basedir);
    })();

    const result = cachedResolveImport(mappedFilenameByPaths, { basedir });

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
