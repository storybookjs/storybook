import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { ensureFile } from '@ndelangen/fs-extra-unified';
import { init, parse } from 'es-module-lexer';
import MagicString from 'magic-string';
import type { Alias, Plugin } from 'vite';

const escapeKeys = (key: string) => key.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
const defaultImportRegExp = 'import ([^*{}]+) from';
const replacementMap = new Map([
  ['import ', 'const '],
  ['import{', 'const {'],
  ['* as ', ''],
  [' as ', ': '],
  [' from ', ' = '],
  ['}from', '} ='],
]);

/**
 * This plugin swaps out imports of pre-bundled storybook preview modules for destructured from global
 * variables that are added in runtime.js.
 *
 * For instance:
 *
 * ```js
 * import { useMemo as useMemo2, useEffect as useEffect2 } from "@storybook/preview-api";
 * ```
 *
 * becomes
 *
 * ```js
 * const { useMemo: useMemo2, useEffect: useEffect2 } = __STORYBOOK_MODULE_PREVIEW_API__;
 * ```
 *
 * It is based on existing plugins like https://github.com/crcong/vite-plugin-externals
 * and https://github.com/eight04/rollup-plugin-external-globals, but simplified to meet our simple needs.
 */
export async function externalGlobalsPlugin(externals: Record<string, string>) {
  await init;
  const { mergeAlias } = await import('vite');

  return {
    name: 'storybook:external-globals-plugin',
    enforce: 'post',
    // In dev (serve), we set up aliases to files that we write into node_modules/.cache.
    async config(config, { command }) {
      if (command !== 'serve') {
        return undefined;
      }
      const newAlias = mergeAlias([], config.resolve?.alias) as Alias[];

      const cachePath = findCacheDirectory({
        name: 'sb-vite-plugin-externals',
        create: true,
      }) as string;
      await Promise.all(
        (Object.keys(externals) as Array<keyof typeof externals>).map(async (externalKey) => {
          const externalCachePath = join(cachePath, `${externalKey}.js`);
          newAlias.push({ find: new RegExp(`^${externalKey}$`), replacement: externalCachePath });
          await ensureFile(externalCachePath);
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
    async transform(code: string, id: string) {
      const globalsList = Object.keys(externals);
      if (globalsList.every((glob) => !code.includes(glob))) return undefined;

      const [imports] = parse(code);
      const src = new MagicString(code);
      imports.forEach(({ n: path, ss: startPosition, se: endPosition }) => {
        const packageName = path;
        if (packageName && globalsList.includes(packageName)) {
          const importStatement = src.slice(startPosition, endPosition);
          const transformedImport = rewriteImport(importStatement, externals, packageName);
          src.update(startPosition, endPosition, transformedImport);
        }
      });

      return {
        code: src.toString(),
        map: src.generateMap({
          source: id,
          hires: true,
        }),
      };
    },
  } satisfies Plugin;
}

function getDefaultImportReplacement(match: string) {
  const matched = match.match(defaultImportRegExp);
  return matched && `const {default: ${matched[1]}} =`;
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
  const search = getSearchRegExp(packageName);
  return importStatement.replace(
    search,
    (match) => replacementMap.get(match) ?? getDefaultImportReplacement(match) ?? globs[packageName]
  );
}
