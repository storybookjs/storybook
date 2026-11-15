import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

import { dirname, join } from 'pathe';
import type { Plugin } from 'rolldown';

// A comment, an `@import` of a stylesheet with its conditions, the `url()` of an asset, or a string.
const REFERENCE =
  /\/\*[\s\S]*?\*\/|@import\s+(?:url\(\s*)?(["']?)([^"')\s]+)\1\s*\)?([^;]*);|url\(\s*(["']?)([^"')]+)\4\s*\)|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/gi;

// A URL with a scheme, a path from the root of the site or a fragment names no file to bundle.
const isBundled = (reference: string) => !/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(reference);

// Rolldown bundles no CSS. A stylesheet becomes a module that adds a `<style>` element, with its
// `@import`s and `url()`s as imports of that module, so Rolldown resolves and inlines them.
export const cssAsStyleElement = (): Plugin => ({
  name: 'storybook:manager-css',
  load: {
    filter: { id: /\.css$/ },
    async handler(id) {
      if (id.endsWith('.module.css')) {
        this.error('CSS modules cannot be bundled into the manager');
      }
      const css = await readFile(id, 'utf-8');
      // CSS resolves a bare path against the stylesheet; a bundler also finds it in a package.
      const specifier = (reference: string) => {
        const path = reference.replace(/[?#].*$/, '');
        const relative = /^\.\.?\//.test(path) || existsSync(join(dirname(id), path));
        return JSON.stringify(relative && !path.startsWith('.') ? `./${path}` : path);
      };
      const imports: string[] = [];
      const text: string[] = [];
      let end = 0;
      for (const match of css.matchAll(REFERENCE)) {
        const [reference, , stylesheet, condition, , asset] = match;
        if (!(stylesheet ?? asset) || !isBundled(stylesheet ?? asset)) {
          continue;
        }
        if (condition?.trim()) {
          this.error(
            `An @import with a condition cannot be bundled into the manager: ${reference}`
          );
        }
        text.push(JSON.stringify(css.slice(end, match.index)));
        end = match.index + reference.length;
        if (stylesheet) {
          imports.push(`import ${specifier(stylesheet)};`);
        } else {
          const name = `asset${imports.length}`;
          imports.push(`import ${name} from ${specifier(asset)};`);
          text.push(`'url(' + JSON.stringify(${name}) + ')'`);
        }
      }
      text.push(JSON.stringify(css.slice(end)));
      return {
        moduleType: 'js',
        code: [
          ...imports,
          `const style = document.createElement('style');`,
          `style.textContent = ${text.join(' + ')};`,
          `document.head.append(style);`,
          `export default {};`,
        ].join('\n'),
      };
    },
  },
});
