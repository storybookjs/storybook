import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { PreviewSources } from '@storybook/core/internal/preview-page';

import * as pkg from 'empathic/package';
import { init, parse } from 'es-module-lexer';
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

export async function storybookExternalGlobalsPlugin(preview: PreviewSources): Promise<Plugin> {
  const { externals, previewRuntimePath } = preview;

  await init;
  const { mergeAlias } = await import('vite');

  const globalsList = Object.keys(externals);
  const globalsCodeFilter = new RegExp(globalsList.map(escapeKeys).join('|'));

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
          code: didRewrite
            ? ensurePreviewRuntimePrecedesGlobals(rewritten, id, previewRuntimePath)
            : rewritten,
          map: null,
        };
      },
    },
  } satisfies Plugin;
}

const bundledPreviewRuntimePattern = /[/\\]dist[/\\]core[/\\]preview[/\\]/;

// Call setup() so init still runs when side-effect imports of this package are dropped.
export function ensurePreviewRuntimePrecedesGlobals(
  code: string,
  id: string,
  previewRuntimePath: string
): string {
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

/**
 * Rewrites a named or namespace re-export of a global; `export *` has no global equivalent and is
 * left as is.
 *
 * @example
 *
 * ```js
 * export { Tag, getFeatures as features } from 'storybook/preview-api';
 * // becomes
 * const { Tag: __sb_reexport_Tag, getFeatures: __sb_reexport_features } = __STORYBOOK_MODULE_PREVIEW_API__; export { __sb_reexport_Tag as Tag, __sb_reexport_features as features };
 * ```
 */
function getReExportReplacement(
  importStatement: string,
  globalReference: string
): string | undefined {
  if (/^export\s*\*\s*from\b/.test(importStatement)) {
    return importStatement;
  }
  const match = importStatement.match(/^export\s*(?:\*\s*as\s+([\w$]+)|\{([^}]*)\})\s*from\b/);
  if (!match) {
    return undefined;
  }
  const statementTerminator = importStatement.trimEnd().endsWith(';') ? ';' : '';
  const [, namespace, specifiers] = match;
  if (namespace) {
    return `const __sb_reexport_${namespace} = ${globalReference}; export { __sb_reexport_${namespace} as ${namespace} }${statementTerminator}`;
  }
  const names = specifiers
    .split(',')
    .map((specifier) => specifier.trim())
    .filter(Boolean)
    .map((specifier) => {
      const [imported, exported = imported] = specifier.split(/\s+as\s+/);
      return { imported, exported };
    });
  const locals = names.map(({ imported, exported }) => `${imported}: __sb_reexport_${exported}`);
  const exports = names.map(({ exported }) => `__sb_reexport_${exported} as ${exported}`);
  return `const { ${locals.join(', ')} } = ${globalReference}; export { ${exports.join(', ')} }${statementTerminator}`;
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

  const reExportReplacement = getReExportReplacement(importStatement, globs[packageName]);

  if (reExportReplacement) {
    return reExportReplacement;
  }

  const search = getSearchRegExp(packageName);
  return importStatement.replace(
    search,
    (match) => replacementMap.get(match) ?? getDefaultImportReplacement(match) ?? globs[packageName]
  );
}
