import { existsSync } from 'node:fs';
import { dirname, sep } from 'node:path';

import { babelParse, types as t } from 'storybook/internal/babel';
import { getProjectRoot, supportedExtensions } from 'storybook/internal/common';

import * as find from 'empathic/find';
import {
  type Documentation,
  builtinHandlers as docgenHandlers,
  builtinResolvers as docgenResolver,
  makeFsImporter,
  parse,
} from 'react-docgen';
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

const getExportPaths = cached(
  (code: string, filePath: string) => {
    const ast = (() => {
      try {
        return babelParse(code);
      } catch (_) {
        return undefined;
      }
    })();

    if (!ast) {
      return [] as string[];
    }
    const basedir = dirname(filePath);
    const body = ast.program.body;
    return body
      .flatMap((n) =>
        t.isExportAllDeclaration(n)
          ? [n.source.value]
          : t.isExportNamedDeclaration(n) && !!n.source && !n.declaration
            ? [n.source.value]
            : []
      )
      .map((s) => matchPath(s))
      .map((s) => {
        try {
          return cachedResolveImport(s, { basedir });
        } catch {
          return undefined;
        }
      })
      .filter((p): p is string => !!p && !p.includes('node_modules'));
  },
  { name: 'getExportPaths' }
);

const gatherDocgensForPath = cached(
  (
    filePath: string,
    depth: number
  ): { docgens: DocObj[]; analyzed: { path: string; code: string }[] } => {
    if (depth > 5 || filePath.includes('node_modules')) {
      return { docgens: [], analyzed: [] };
    }

    let code: string | undefined;
    try {
      code = cachedReadFileSync(filePath, 'utf-8') as string;
    } catch {}

    if (!code) {
      return { docgens: [], analyzed: [{ path: filePath, code: code! }] };
    }

    const reexportResults = getExportPaths(code, filePath).map((p) =>
      gatherDocgensForPath(p, depth + 1)
    );
    const fromReexports = reexportResults.flatMap((r) => r.docgens);
    const analyzedChildren = reexportResults.flatMap((r) => r.analyzed);

    const locals = (() => {
      try {
        return parseWithReactDocgen(code as string, filePath);
      } catch {
        return [] as DocObj[];
      }
    })();

    return {
      docgens: [...locals, ...fromReexports],
      analyzed: [{ path: filePath, code }, ...analyzedChildren],
    };
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
    if (path.includes('node_modules')) {
      return {
        type: 'error',
        error: {
          name: 'Component file in node_modules',
          message: `Component files in node_modules are not supported. Please import your component file directly.`,
        },
      };
    }

    const docgenWithInfo = gatherDocgensForPath(path, 0);
    const docgens = docgenWithInfo.docgens;

    const noCompDefError = {
      type: 'error' as const,
      error: {
        name: 'No component definition found',
        message:
          `Could not find a component definition.\n` +
          `Prefer relative imports if possible.\n` +
          `Avoid pointing to transpiled files.\n` +
          `You can debug your component file in this playground: https://react-docgen.dev/playground\n\n` +
          docgenWithInfo.analyzed.map(({ path, code }) => `File: ${path}\n${code}`).join('\n'),
      },
    };

    if (!docgens || docgens.length === 0) {
      return noCompDefError;
    }

    const docgen = getMatchingDocgen(docgens, component);
    if (!docgen) {
      return noCompDefError;
    }
    return { type: 'success', data: docgen };
  },
  { name: 'getReactDocgen', key: (path, component) => path + JSON.stringify(component) }
);

export function getReactDocgenImporter() {
  return makeFsImporter((filename, basedir) => {
    const mappedFilenameByPaths = (() => {
      return matchPath(filename);
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
