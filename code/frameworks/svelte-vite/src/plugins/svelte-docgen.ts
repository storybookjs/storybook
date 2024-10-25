import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, relative } from 'node:path';

import { logger } from 'storybook/internal/node-logger';

import MagicString from 'magic-string';
import replace from 'svelte-preprocess/dist/processors/replace.js';
import typescript from 'svelte-preprocess/dist/processors/typescript.js';
import { preprocess } from 'svelte/compiler';
import type {
  JSDocType,
  SvelteComponentDoc,
  SvelteDataItem,
  SvelteParserOptions,
} from 'sveltedoc-parser';
import svelteDoc from 'sveltedoc-parser';
import type { PluginOption } from 'vite';

import { type Docgen, type Type, createDocgenCache, generateDocgen } from './generateDocgen';

const require = createRequire(import.meta.url);

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
  if (!filename) {
    return null;
  }

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

function transformToSvelteDocParserType(type: Type): JSDocType {
  switch (type.type) {
    case 'string':
      return { kind: 'type', type: 'string', text: 'string' };
    case 'number':
      return { kind: 'type', type: 'number', text: 'number' };
    case 'boolean':
      return { kind: 'type', type: 'boolean', text: 'boolean' };
    case 'symbol':
      return { kind: 'type', type: 'other', text: 'symbol' };
    case 'null':
      return { kind: 'type', type: 'other', text: 'null' };
    case 'undefined':
      return { kind: 'type', type: 'other', text: 'undefined' };
    case 'void':
      return { kind: 'type', type: 'other', text: 'void' };
    case 'any':
      return { kind: 'type', type: 'any', text: 'any' };
    case 'object':
      return { kind: 'type', type: 'object', text: type.text };
    case 'array':
      return { kind: 'type', type: 'array', text: type.text };
    case 'function':
      return { kind: 'function', text: type.text };
    case 'literal':
      return { kind: 'const', type: typeof type.value, value: type.value, text: type.text };
    case 'union': {
      const nonNull = type.types.filter((t) => t.type !== 'null'); // ignore null
      const text = nonNull.map((t): string => transformToSvelteDocParserType(t).text).join(' | ');
      const types = nonNull.map((t) => transformToSvelteDocParserType(t));
      return types.length === 1 ? types[0] : { kind: 'union', type: types, text };
    }
    case 'intersection': {
      const text = type.types
        .map((t): string => transformToSvelteDocParserType(t).text)
        .join(' & ');
      return { kind: 'type', type: 'intersection', text };
    }
  }
}

/** Mimic sveltedoc-parser's props data structure */
function transformToSvelteDocParserDataItems(docgen: Docgen): SvelteDataItem[] {
  return docgen.props.map((p) => {
    const required = p.optional === false && p.defaultValue === undefined;
    return {
      name: p.name,
      visibility: 'public',
      description: p.description,
      keywords: required ? [{ name: 'required', description: '' }] : [],
      kind: 'let',
      type: p.type ? transformToSvelteDocParserType(p.type) : undefined,
      static: false,
      readonly: false,
      importPath: undefined,
      originalName: undefined,
      localName: undefined,
      defaultValue: p.defaultValue ? p.defaultValue.text : undefined,
    } satisfies SvelteDataItem;
  });
}

export async function svelteDocgen(svelteOptions: Record<string, any> = {}): Promise<PluginOption> {
  const cwd = process.cwd();
  const { preprocess: preprocessOptions, logDocgen = false } = svelteOptions;
  const include = /\.(svelte)$/;
  const { createFilter } = await import('vite');

  const filter = createFilter(include);
  const sourceFileCache = createDocgenCache();

  let docPreprocessOptions: Parameters<typeof preprocess>[1] | undefined;

  return {
    name: 'storybook:svelte-docgen-plugin',
    async transform(src: string, id: string) {
      if (!filter(id)) {
        return undefined;
      }

      const resource = relative(cwd, id);

      // Get props information
      const docgen = generateDocgen(resource, sourceFileCache);
      const data = transformToSvelteDocParserDataItems(docgen);

      let componentDoc: SvelteComponentDoc & { keywords?: string[] } = {};

      if (!docgen.propsRuneUsed) {
        // Retain sveltedoc-parser for backward compatibility, as it can extract slot information from HTML comments.
        // See: https://github.com/alexprey/sveltedoc-parser/issues/61
        //
        // Note: Events are deprecated in Svelte 5, and slots cannot be used in runes mode.

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

        let docOptions;
        if (docPreprocessOptions) {
          const rawSource = readFileSync(resource).toString();
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

        try {
          componentDoc = await svelteDoc.parse(options);
        } catch (error: any) {
          componentDoc = { keywords: [], data: [] };
          if (logDocgen) {
            logger.error(error);
          }
        }
      }

      // Always use props info from generateDocgen
      componentDoc.data = data;

      // get filename for source content
      const file = basename(resource);

      componentDoc.name = basename(file);

      const s = new MagicString(src);
      const componentName = getNameFromFilename(resource);
      s.append(`;${componentName}.__docgen = ${JSON.stringify(componentDoc)}`);

      return {
        code: s.toString(),
        map: s.generateMap({ hires: true, source: id }),
      };
    },
  };
}
