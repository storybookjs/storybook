import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { globalsNameReferenceMap } from 'storybook/internal/preview/globals';
import type { Options } from 'storybook/internal/types';

import { previewRuntimePath } from '../utils/preview-runtime-path.ts';

import * as pkg from 'empathic/package';
import { type ImportSpecifier, init, parse } from 'es-module-lexer';
import MagicString from 'magic-string';
import type { Alias, Plugin } from 'vite';

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
  const { mergeAlias } = await import('vite');

  const globalsList = Object.keys(externals);
  const globalReferences = Object.values(externals);

  return {
    name: 'storybook:external-globals-plugin',
    enforce: 'post',
    // In dev (serve), we set up aliases to files that we write into node_modules/.cache.
    async config(config, { command }) {
      if (command !== 'serve') {
        return undefined;
      }
      const newAlias = mergeAlias([], config.resolve?.alias) as Alias[];

      const cachePath =
        pkg.cache('sb-vite-plugin-externals', { create: true }) ??
        join(process.cwd(), 'node_modules', '.cache', 'sb-vite-plugin-externals');

      await Promise.all(
        (Object.keys(externals) as Array<keyof typeof externals>).map(async (externalKey) => {
          const externalCachePath = join(cachePath, `${externalKey}.js`);
          newAlias.push({ find: new RegExp(`^${externalKey}$`), replacement: externalCachePath });
          if (!existsSync(externalCachePath)) {
            const directory = dirname(externalCachePath);
            await mkdir(directory, { recursive: true });
          }
          await writeFile(externalCachePath, `module.exports = ${externals[externalKey]};`);
        })
      );

      return {
        resolve: {
          alias: newAlias,
        },
      };
    },
    // Replace imports with variables destructured from global scope
    transform: {
      filter: { code: { include: [...globalsList, ...globalReferences] } },
      async handler(code: string, id: string) {
        // Optimized deps inline the dev-only alias files, so they read a global without an import.
        const readsInlinedGlobal =
          this.environment.mode === 'dev' &&
          globalReferences.some((reference) => code.includes(reference));

        let imports: readonly ImportSpecifier[];
        try {
          [imports] = parse(code);
        } catch {
          // Leave invalid code (e.g. JSX in a .js file) to the plugins that report syntax errors
          return undefined;
        }
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
          code:
            didRewrite || readsInlinedGlobal
              ? ensurePreviewRuntimePrecedesGlobals(rewritten, id)
              : rewritten,
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
