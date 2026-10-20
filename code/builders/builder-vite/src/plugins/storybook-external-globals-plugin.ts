import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { globalsNameReferenceMap } from 'storybook/internal/preview/globals';
import type { Options } from 'storybook/internal/types';

import { previewRuntimePath } from '../utils/preview-runtime-path.ts';
import { depOptimizerResolveOptions } from '../utils/vite-features.ts';

import * as pkg from 'empathic/package';
import { init, parse } from 'es-module-lexer';
import MagicString from 'magic-string';
import { normalizePath, type Plugin } from 'vite';

// Storybook's preview, served in dev and written by a build
const previewEnvironmentName = 'client';

const escapeKeys = (key: string) => key.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
const defaultImportRegExp = 'import ([^*{}]+) from';
const emptyImportRegExp = /^import(?:\s*\{\s*\}\s*from)?\s*['"][^'"]+['"]\s*;?$/;
const replacementMap = new Map([
  ['import ', 'const '],
  ['import{', 'const {'],
  ['* as ', ''],
  [' as ', ': '],
  [' from ', ' = '],
  ['}from', '} ='],
]);

/**
 * This plugin swaps out imports of pre-bundled storybook preview modules for destructured from
 * global variables that are added in runtime.js.
 *
 * @example
 *
 * ```js
 * import { useMemo as useMemo2, useEffect as useEffect2 } from 'storybook/preview-api';
 * ```
 *
 * Becomes
 *
 * ```js
 * const { useMemo: useMemo2, useEffect: useEffect2 } = __STORYBOOK_MODULE_PREVIEW_API__;
 * ```
 *
 * It is based on existing plugins like https://github.com/crcong/vite-plugin-externals and
 * https://github.com/eight04/rollup-plugin-external-globals, but simplified to meet our simple
 * needs.
 */

export async function storybookExternalGlobalsPlugin(options: Options): Promise<Plugin> {
  const build = await options.presets.apply('build');

  const externals: typeof globalsNameReferenceMap & Record<string, string> =
    globalsNameReferenceMap;

  if (build?.test?.disableBlocks) {
    externals['@storybook/addon-docs/blocks'] = '__STORYBOOK_BLOCKS_EMPTY_MODULE__';
  }

  await init;

  const globalsList = Object.keys(externals);
  const globalsCodeFilter = new RegExp(globalsList.map(escapeKeys).join('|'));
  const globalsIdFilter = new RegExp(`^(?:${globalsList.map(escapeKeys).join('|')})$`);
  // In dev, each package resolves to a CommonJS file that exports its global. Empty in a build.
  const stubPaths = new Map<string, string>();
  const resolveStub = (id: string) => stubPaths.get(id);

  return {
    name: 'storybook:external-globals-plugin',
    enforce: 'post',
    // The preview is Vite's client environment. Other environments, such as those a plugin adds,
    // keep their imports of these packages.
    applyToEnvironment: (environment) => environment.name === previewEnvironmentName,
    // In dev (serve), we write the stubs into node_modules/.cache.
    async config(_config, { command }) {
      if (command !== 'serve') {
        return;
      }

      const cachePath =
        pkg.cache('sb-vite-plugin-externals', { create: true }) ??
        join(process.cwd(), 'node_modules', '.cache', 'sb-vite-plugin-externals');

      await Promise.all(
        (Object.keys(externals) as Array<keyof typeof externals>).map(async (externalKey) => {
          const externalCachePath = join(cachePath, `${externalKey}.js`);
          if (!existsSync(externalCachePath)) {
            const directory = dirname(externalCachePath);
            await mkdir(directory, { recursive: true });
          }
          await writeFile(externalCachePath, `module.exports = ${externals[externalKey]};`);
          stubPaths.set(externalKey, normalizePath(externalCachePath));
        })
      );
    },
    // `resolve.alias` is shared by all environments (`EnvironmentResolveOptions` has no `alias`),
    // and pre-bundling resolves with the alias and the optimizer's own plugins only. So the
    // preview's environment resolves the stubs with this hook and with a plugin of its optimizer,
    // which pre-bundles the dependencies that import these packages.
    configEnvironment(name, _config, { command }) {
      if (name !== previewEnvironmentName || command !== 'serve') {
        return null;
      }
      return {
        optimizeDeps: depOptimizerResolveOptions(
          'storybook:external-globals',
          globalsIdFilter,
          resolveStub
        ),
      };
    },
    resolveId: {
      // A hook ordered `pre` runs before the plain hooks of the alias plugin and Vite's resolver,
      // which would resolve the package itself
      order: 'pre',
      filter: { id: globalsIdFilter },
      // The stub's path resolves on through the other plugins, as an alias's replacement does
      async handler(id, importer, resolveOptions) {
        const stubPath = resolveStub(id);
        return stubPath && this.resolve(stubPath, importer, { ...resolveOptions, skipSelf: true });
      },
    },
    // Replace imports with variables destructured from global scope
    transform: {
      filter: { code: globalsCodeFilter },
      async handler(code: string, id: string) {
        if (globalsList.every((glob) => !code.includes(glob))) {
          return undefined;
        }

        const [imports] = parse(code);
        const src = new MagicString(code);
        let didRewrite = false;
        imports.forEach(({ n: path, ss: startPosition, se: endPosition }) => {
          const packageName = path;
          if (packageName && globalsList.includes(packageName)) {
            const importStatement = src.slice(startPosition, endPosition);
            const transformedImport = rewriteImport(importStatement, externals, packageName);
            src.update(startPosition, endPosition, transformedImport);
            didRewrite = true;
          }
        });

        const rewritten = src.toString();
        return {
          code: didRewrite ? ensurePreviewRuntimePrecedesGlobals(rewritten, id) : rewritten,
          map: null,
        };
      },
    },
  } satisfies Plugin;
}

const bundledPreviewRuntimePattern = /[/\\]dist[/\\]preview[/\\]/;

// Call setup() so init still runs when side-effect imports of this package are dropped.
export function ensurePreviewRuntimePrecedesGlobals(code: string, id: string) {
  if (bundledPreviewRuntimePattern.test(id.split('?')[0])) {
    return code;
  }

  return `import { setup as __sbInitializePreviewGlobals } from ${JSON.stringify(previewRuntimePath)};\n__sbInitializePreviewGlobals();\n${code}`;
}

function getDefaultImportReplacement(match: string) {
  const matched = match.match(defaultImportRegExp);
  return matched && `const {default: ${matched[1]}} =`;
}

function getEmptyImportReplacement(importStatement: string, globalReference: string) {
  if (!emptyImportRegExp.test(importStatement.trim())) {
    return undefined;
  }

  const statementTerminator = importStatement.trimEnd().endsWith(';') ? ';' : '';
  return `void ${globalReference}${statementTerminator}`;
}

function getSearchRegExp(packageName: string) {
  const staticKeys = [...replacementMap.keys()].map(escapeKeys);
  const packageNameLiteral = `.${packageName}.`;
  const dynamicImportExpression = `await import\\(.${packageName}.\\)`;
  const lookup = [defaultImportRegExp, ...staticKeys, packageNameLiteral, dynamicImportExpression];
  return new RegExp(`(${lookup.join('|')})`, 'g');
}

export function rewriteImport(
  importStatement: string,
  globs: Record<string, string>,
  packageName: string
): string {
  const emptyImportReplacement = getEmptyImportReplacement(importStatement, globs[packageName]);

  if (emptyImportReplacement) {
    return emptyImportReplacement;
  }

  const search = getSearchRegExp(packageName);
  return importStatement.replace(
    search,
    (match) => replacementMap.get(match) ?? getDefaultImportReplacement(match) ?? globs[packageName]
  );
}
