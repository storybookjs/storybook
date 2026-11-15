import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

import { dirname, join } from 'pathe';
import type { Plugin, PluginContext } from 'rolldown';

// A comment, an `@import` of a stylesheet with its conditions, the `url()` of an asset, or a string.
// A quoted path may hold spaces and parentheses, and the last `@import` of a file needs no `;`.
const REFERENCE = new RegExp(
  [
    String.raw`\/\*[\s\S]*?\*\/`,
    String.raw`@import\s+(?:url\(\s*)?(?:(?<importQuote>["'])(?<quotedImport>(?:(?!\k<importQuote>).)+)\k<importQuote>|(?<bareImport>[^"')\s;]+))\s*\)?(?<condition>[^;]*)(?:;|$)`,
    String.raw`url\(\s*(?:(?<urlQuote>["'])(?<quotedUrl>(?:(?!\k<urlQuote>).)+)\k<urlQuote>|(?<bareUrl>[^"')\s]+))\s*\)`,
    String.raw`"(?:[^"\\\n]|\\.)*"`,
    String.raw`'(?:[^'\\\n]|\\.)*'`,
  ].join('|'),
  'gi'
);

// What may come before an `@import`. A browser ignores an `@import` after anything else.
const BEFORE_IMPORT = /\s+|\/\*[\s\S]*?\*\/|@(?:charset|import|layer)\s[^;{]*;/gi;

// The conditions of an `@import`: a layer, a `supports()` and a media query, in that order.
const CONDITION =
  /^(?:(layer)(?:\(([^)]*)\))?\s*)?(?:supports\(((?:[^()]|\([^()]*\))*)\)\s*)?(.*)$/is;

// A URL with a scheme, a path from the root of the site or a fragment names no file to bundle.
const isBundled = (reference: string) => !/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(reference);

// The text of a stylesheet as the parts of a JavaScript expression, with the stylesheets it imports
// in place of their `@import`, and each asset as the name of its import in `assets`.
const inline = async (
  context: PluginContext,
  file: string,
  importers: string[],
  assets: Map<string, string>
): Promise<string[]> => {
  // A byte order mark would become part of the first selector.
  const css = (await readFile(file, 'utf-8')).replace(/^﻿/, '');

  // CSS resolves a bare path against the stylesheet; a bundler also finds it in a package.
  const resolve = async (path: string) => {
    const relative = join(dirname(file), path);
    if (existsSync(relative)) {
      return relative;
    }
    const resolved = await context.resolve(path, file);
    return resolved?.id ?? context.error(`Could not resolve ${path} in ${file}`);
  };

  const parts: string[] = [];
  let end = 0;
  for (const match of css.matchAll(REFERENCE)) {
    const { quotedImport, bareImport, condition, quotedUrl, bareUrl } = match.groups ?? {};
    const stylesheet = quotedImport ?? bareImport;
    const asset = quotedUrl ?? bareUrl;
    const isLateImport = stylesheet && css.slice(0, match.index).replace(BEFORE_IMPORT, '') !== '';
    if (!(stylesheet ?? asset) || !isBundled(stylesheet ?? asset) || isLateImport) {
      continue;
    }
    parts.push(JSON.stringify(css.slice(end, match.index)));
    end = match.index + match[0].length;
    // esbuild kept the fragment of a URL without a query, such as `sprite.svg#icon`.
    const [, path, fragment = ''] = /^([^?#]*)(?:\?.*|(#.*))?$/.exec(stylesheet ?? asset)!;
    const resolved = await resolve(path);
    if (asset) {
      const name = assets.get(resolved) ?? `asset${assets.size}`;
      assets.set(resolved, name);
      parts.push(`'url(' + JSON.stringify(${name} + ${JSON.stringify(fragment)}) + ')'`);
    } else if (!importers.includes(resolved) && resolved !== file) {
      const [, layer, layerName = '', supports, media] = CONDITION.exec(condition.trim())!;
      const rules = [
        layer && `@layer ${layerName}`,
        supports && `@supports (${supports})`,
        media && `@media ${media}`,
      ].filter(Boolean);
      parts.push(
        JSON.stringify(rules.map((rule) => `${rule} {\n`).join('')),
        ...(await inline(context, resolved, [...importers, file], assets)),
        JSON.stringify('}\n'.repeat(rules.length))
      );
    }
  }
  return [...parts, JSON.stringify(css.slice(end))];
};

// Rolldown bundles no CSS. A stylesheet becomes a module that adds a `<style>` element with its
// text, and its assets become imports of that module, so Rolldown inlines them as it does for a
// script.
export const cssAsStyleElement = (): Plugin => ({
  name: 'storybook:manager-css',
  load: {
    filter: { id: /\.css$/ },
    async handler(id) {
      if (id.endsWith('.module.css')) {
        this.error('CSS modules cannot be bundled into the manager');
      }
      const assets = new Map<string, string>();
      const text = await inline(this, id, [], assets);
      return {
        moduleType: 'js',
        code: [
          ...[...assets].map(([path, name]) => `import ${name} from ${JSON.stringify(path)};`),
          `const style = document.createElement('style');`,
          `style.textContent = ${text.join(' + ')};`,
          `document.head.append(style);`,
          `export default {};`,
        ].join('\n'),
      };
    },
  },
});
