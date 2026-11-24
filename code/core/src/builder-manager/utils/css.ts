import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

import { resolveModulePath } from 'exsolve';
import { dirname, extname, join } from 'pathe';
import type { Plugin } from 'rolldown';

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.eot': 'application/vnd.ms-fontobject',
  '.ttf': 'font/ttf',
};

// A URL with a scheme or a host is fetched by the browser. So is a fragment.
const isRemote = (url: string) => /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(url);

const REMOTE_FILE = '\0remote:';
const REMOTE_CLASS = 'storybook-remote-import-';

type Rule = { type: string; value?: unknown };

const remoteIndex = ({ type, value }: Rule) => {
  if (type !== 'style') {
    return undefined;
  }
  const name = (value as { selectors: { name?: unknown }[][] }).selectors[0]?.[0]?.name;
  return typeof name === 'string' && name.startsWith(REMOTE_CLASS)
    ? Number(name.slice(REMOTE_CLASS.length))
    : undefined;
};

export interface Stylesheet {
  // The URLs it imports, which the browser fetches and which must come before any rule.
  imports: string[];
  css: string;
}

// Rolldown bundles no CSS, so each stylesheet a script imports is bundled by Lightning CSS: its
// `@import`s are inlined, a `url()` of a local file becomes a data URL, and a `.module.css` file
// exports its class names. The result goes to `stylesheets`, by the id of the importing module.
export const cssPlugin = (
  stylesheets: Map<string, Stylesheet>,
  dataUrlExtensions: Set<string>,
  minify: boolean
): Plugin => ({
  name: 'storybook:manager-css',
  load: {
    filter: { id: /\.css$/ },
    handler: async (id) => {
      const { bundleAsync } = await import('lightningcss');
      const remote: string[] = [];
      const imports: string[] = [];

      // Lightning CSS inlines every `@import`. One of a URL is inlined as a rule that stands for
      // it, which is found where the import was: at the top level, or inside its condition.
      const failOnRemote = ({ value }: { value: { rules: Rule[] } }) => {
        const index = value.rules.map(remoteIndex).find((found) => found !== undefined);
        if (index !== undefined) {
          throw new Error(
            `Cannot bundle ${id}: the @import of ${remote[index]} has a media query, supports() or layer(), which is not supported for a URL.`
          );
        }
      };

      const { code, exports, dependencies } = await bundleAsync({
        filename: id,
        cssModules: /\.module\.css$/.test(id),
        analyzeDependencies: true,
        minify,
        resolver: {
          resolve(specifier, from) {
            if (isRemote(specifier)) {
              return `${REMOTE_FILE}${remote.push(specifier) - 1}`;
            }
            const file = join(dirname(from), specifier);
            return existsSync(file) ? file : resolveModulePath(specifier, { from });
          },
          read: (file) =>
            file.startsWith(REMOTE_FILE)
              ? `.${REMOTE_CLASS}${file.slice(REMOTE_FILE.length)}{top:0}`
              : readFile(file, 'utf8'),
        },
        visitor: {
          Rule: {
            media: failOnRemote,
            supports: failOnRemote,
            'layer-block': failOnRemote,
            style(rule) {
              const index = remoteIndex(rule);
              if (index === undefined) {
                return undefined;
              }
              imports.push(remote[index]);
              return [];
            },
          },
        },
      });

      let css = code.toString();
      for (const dependency of dependencies ?? []) {
        if (dependency.type !== 'url' || isRemote(dependency.url)) {
          continue;
        }
        const file = join(dirname(dependency.loc.filePath), dependency.url);
        const extension = extname(file);
        if (!dataUrlExtensions.has(extension)) {
          throw new Error(
            `Cannot bundle ${id}: no loader is configured for "${extension}" files such as ${file}.`
          );
        }
        css = css.replace(
          dependency.placeholder,
          `data:${MIME_TYPES[extension]};base64,${(await readFile(file)).toString('base64')}`
        );
      }
      stylesheets.set(id, { imports, css });

      // A class that composes others stands for all of their names.
      const classNames = Object.entries(exports ?? {}).map(([name, { name: local, composes }]) => ({
        name,
        value: [local, ...composes.map((composed) => composed.name)].join(' '),
      }));
      return {
        code: [
          ...classNames.map(({ value }, index) => `const c${index} = ${JSON.stringify(value)};`),
          // A class name need not be an identifier, and a string names any export.
          ...classNames
            .filter(({ name }) => name !== 'default')
            .map(({ name }, index) => `export { c${index} as ${JSON.stringify(name)} };`),
          `export default { ${classNames.map(({ name }, index) => `${JSON.stringify(name)}: c${index}`).join(', ')} };`,
        ].join('\n'),
        moduleType: 'js',
      };
    },
  },
});
