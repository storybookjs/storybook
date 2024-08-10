import fs from 'node:fs';
import path from 'node:path';

import { logger } from 'storybook/internal/node-logger';

import MagicString from 'magic-string';
import { replace, typescript } from 'svelte-preprocess';
import { preprocess } from 'svelte/compiler';
import svelteDoc from 'sveltedoc-parser';
import type { SvelteComponentDoc, SvelteParserOptions } from 'sveltedoc-parser';
import type { PluginOption } from 'vite';

/*
 * Patch sveltedoc-parser internal options.
 * Waiting for a fix for https://github.com/alexprey/sveltedoc-parser/issues/87
 */
const svelteDocParserOptions = require('sveltedoc-parser/lib/options.js');

svelteDocParserOptions.getAstDefaultOptions = () => ({
  range: true,
  loc: true,
  comment: true,
  tokens: true,
  ecmaVersion: 12,
  sourceType: 'module',
  ecmaFeatures: {},
});

// Most of the code here should probably be exported by @storybook/svelte and reused here.
// See: https://github.com/storybookjs/storybook/blob/next/app/svelte/src/server/svelte-docgen-loader.ts

// From https://github.com/sveltejs/svelte/blob/8db3e8d0297e052556f0b6dde310ef6e197b8d18/src/compiler/compile/utils/get_name_from_filename.ts
// Copied because it is not exported from the compiler
function getNameFromFilename(filename: string) {
  if (!filename) return null;

  const parts = filename.split(/[/\\]/).map(encodeURI);

  if (parts.length > 1) {
    const indexMatch = parts[parts.length - 1].match(/^index(\.\w+)/);
    if (indexMatch) {
      parts.pop();
      parts[parts.length - 1] += indexMatch[1];
    }
  }

  const base = parts
    .pop()
    ?.replace(/%/g, 'u')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z_$0-9]+/g, '_')
    .replace(/^_/, '')
    .replace(/_$/, '')
    .replace(/^(\d)/, '_$1');

  if (!base) {
    throw new Error(`Could not derive component name from file ${filename}`);
  }

  return base[0].toUpperCase() + base.slice(1);
}

export async function svelteDocgen(svelteOptions: Record<string, any> = {}): Promise<PluginOption> {
  const cwd = process.cwd();
  const { preprocess: preprocessOptions, logDocgen = false } = svelteOptions;
  const include = /\.(svelte)$/;
  const { createFilter } = await import('vite');

  const filter = createFilter(include);

  let docPreprocessOptions: Parameters<typeof preprocess>[1] | undefined;

  return {
    name: 'storybook:svelte-docgen-plugin',
    async transform(src: string, id: string) {
      if (!filter(id)) return undefined;

      if (preprocessOptions && !docPreprocessOptions) {
        /*
         * We can't use vitePreprocess() for the documentation
         * because it uses esbuild which removes jsdoc.
         *
         * By default, only typescript is transpiled, and style tags are removed.
         *
         * Note: these preprocessors are only used to make the component
         * compatible to sveltedoc-parser (no ts), not to compile
         * the component.
         */
        docPreprocessOptions = [replace([[/<style.+<\/style>/gims, '']])];

        try {
          const ts = require.resolve('typescript');
          if (ts) {
            docPreprocessOptions.unshift(typescript());
          }
        } catch {
          // this will error in JavaScript-only projects, this is okay
        }
      }

      const resource = path.relative(cwd, id);

      let docOptions;
      if (docPreprocessOptions) {
        const rawSource = fs.readFileSync(resource).toString();

        const { code: fileContent } = await preprocess(rawSource, docPreprocessOptions, {
          filename: resource,
        });

        docOptions = {
          fileContent,
        };
      } else {
        docOptions = { filename: resource };
      }

      // set SvelteDoc options
      const options: SvelteParserOptions = {
        ...docOptions,
        version: 3,
      };

      const s = new MagicString(src);

      let componentDoc: SvelteComponentDoc & { keywords?: string[] };
      try {
        componentDoc = await svelteDoc.parse(options);
      } catch (error: any) {
        componentDoc = { keywords: [], data: [] };
        if (logDocgen) {
          logger.error(error);
        }
      }

      // get filename for source content
      const file = path.basename(resource);

      componentDoc.name = path.basename(file);

      const componentName = getNameFromFilename(resource);
      s.append(`;${componentName}.__docgen = ${JSON.stringify(componentDoc)}`);

      return {
        code: s.toString(),
        map: s.generateMap({ hires: true, source: id }),
      };
    },
  };
}
