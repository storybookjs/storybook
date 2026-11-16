import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

import { dirname, join } from 'pathe';
import type { Plugin, PluginContext } from 'rolldown';

// A comment, an `@import` of a stylesheet with its conditions, the `url()` of an asset, a string, or
// the start of an `@import` or a `url()` that is none of those. A quoted path may hold spaces and
// parentheses, a minifier leaves no space after `@import`, and the last one of a file needs no `;`.
const REFERENCE = new RegExp(
  [
    String.raw`\/\*[\s\S]*?\*\/`,
    String.raw`@import\s*(?:url\(\s*)?(?:(?<importQuote>["'])(?<quotedImport>(?:\\.|(?!\k<importQuote>)[^\\\n])*)\k<importQuote>|(?<bareImport>(?:\\.|[^"'()\s;\\])+))\s*\)?(?<condition>[^;]*)(?:;|$)`,
    String.raw`url\(\s*(?:(?<urlQuote>["'])(?<quotedUrl>(?:\\.|(?!\k<urlQuote>)[^\\\n])*)\k<urlQuote>|(?<bareUrl>(?:\\.|[^"'()\s\\])+))\s*\)`,
    String.raw`"(?:[^"\\\n]|\\.)*"`,
    String.raw`'(?:[^'\\\n]|\\.)*'`,
    String.raw`(?:@import(?![\w-])\s*(?:url\(\s*)?|url\(\s*)["']?(?<unread>[^\s;)]*)`,
  ].join('|'),
  'gi'
);

// An escape is a backslash before a character, or before the hexadecimal number of one.
const unescape = (path: string) =>
  path.replace(/\\(?:([\da-f]{1,6})\s?|(.))/gi, (_, hex, character) =>
    hex ? String.fromCodePoint(parseInt(hex, 16)) : character
  );

// What may come before an `@import`: a browser ignores one after anything else. A URL may hold a `;`.
const BEFORE_IMPORTS =
  /^(?:\s+|\/\*[\s\S]*?\*\/|@(?:charset|import|layer)(?![\w-])(?:"[^"]*"|'[^']*'|url\((?:"[^"]*"|'[^']*'|[^)"'])*\)|[^;{"'])*;?)*/i;

// The conditions of an `@import`: a layer, a `supports()` and a media query, in that order.
const CONDITION =
  /^(?:(layer)(?:\(([^)]*)\))?\s*)?(?:supports\(((?:[^()]|\((?:[^()]|\([^()]*\))*\))*)\)\s*)?(.*)$/is;

// A URL with a scheme, a path from the root of the site or a fragment names no file to bundle.
const isBundled = (reference: string) => !/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(reference);

// Stands between the text of two style elements. A string of JSON holds no such character.
const NEXT_STYLE_ELEMENT = '\0';

// The text of each style element for a stylesheet, as a JavaScript expression, and the name of the
// import of each asset. A stylesheet that it imports takes the place of its `@import`, as in CSS.
const bundle = async (context: PluginContext, entry: string) => {
  const assets = new Map<string, string>();
  let hasStylesheet = false;

  const inline = async (
    file: string,
    importers: string[],
    isConditional: boolean
  ): Promise<string[]> => {
    // A byte order mark would become part of the first selector.
    const css = (await readFile(file, 'utf-8')).replace(/^\uFEFF/, '');
    const importsEnd = BEFORE_IMPORTS.exec(css)![0].length;

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
      const { quotedImport, bareImport, condition, quotedUrl, bareUrl, unread } =
        match.groups ?? {};
      const stylesheet = quotedImport ?? bareImport;
      const escaped = stylesheet ?? quotedUrl ?? bareUrl;
      // A browser ignores an `@import` after a rule.
      const isIgnored = match[0].startsWith('@') && match.index >= importsEnd;
      // Left as it is, the browser would look for the file next to the page.
      if (unread && isBundled(unread) && !isIgnored) {
        context.error(`Could not read ${css.slice(match.index).split('\n', 1)[0]} in ${file}`);
      }
      if (!escaped || isIgnored) {
        continue;
      }
      const reference = unescape(escaped);
      if (!isBundled(reference)) {
        if (stylesheet && isConditional) {
          context.error(
            `${file} is imported with a condition, so its @import of ${reference} cannot be bundled into the manager`
          );
        }
        // After a stylesheet, a browser reads an `@import` only at the start of a style element.
        if (stylesheet && hasStylesheet) {
          parts.push(JSON.stringify(css.slice(end, match.index)), NEXT_STYLE_ELEMENT);
          end = match.index;
          hasStylesheet = false;
        }
        continue;
      }
      parts.push(JSON.stringify(css.slice(end, match.index)));
      end = match.index + match[0].length;
      // A fragment without a query names a part of the asset, such as `sprite.svg#icon`.
      const [, path, fragment = ''] = /^([^?#]*)(?:\?.*|(#.*))?$/.exec(reference)!;
      const resolved = await resolve(path);
      if (!stylesheet) {
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
          ...(await inline(resolved, [...importers, file], isConditional || rules.length > 0)),
          JSON.stringify('}\n'.repeat(rules.length))
        );
        hasStylesheet = true;
      }
    }
    return [...parts, JSON.stringify(css.slice(end))];
  };

  const text = (await inline(entry, [], false)).join(' + ');
  return { assets, styles: text.split(` + ${NEXT_STYLE_ELEMENT} + `) };
};

// Rolldown bundles no CSS. A stylesheet becomes a module that adds its text in style elements, and
// its assets become imports of that module, so Rolldown inlines them as it does for a script.
export const cssAsStyleElement = (): Plugin => ({
  name: 'storybook:manager-css',
  load: {
    filter: { id: /\.css$/ },
    async handler(id) {
      if (id.endsWith('.module.css')) {
        this.error('CSS modules cannot be bundled into the manager');
      }
      const { assets, styles } = await bundle(this, id);
      return {
        moduleType: 'js',
        code: [
          ...[...assets].map(([path, name]) => `import ${name} from ${JSON.stringify(path)};`),
          ...styles.map(
            (text) =>
              `document.head.append(Object.assign(document.createElement('style'), { textContent: ${text} }));`
          ),
          `export default {};`,
        ].join('\n'),
      };
    },
  },
});
