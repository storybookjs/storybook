import svelteDoc from 'sveltedoc-parser';
import { dedent } from 'ts-dedent';
import * as path from 'path';
import * as fs from 'fs';
import { preprocess } from 'svelte/compiler';
import { logger } from 'storybook/internal/node-logger';

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

// From https://github.com/sveltejs/svelte/blob/8db3e8d0297e052556f0b6dde310ef6e197b8d18/src/compiler/compile/utils/get_name_from_filename.ts
// Copied because it is not exported from the compiler
function getNameFromFilename(filename: string) {
  if (!filename) return null;

  const parts = filename.split(/[/\\]/).map(encodeURI);

  if (parts.length > 1) {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const index_match = parts[parts.length - 1].match(/^index(\.\w+)/);
    if (index_match) {
      parts.pop();
      parts[parts.length - 1] += index_match[1];
    }
  }

  const value = parts.pop();

  if (!value) {
    throw new Error(`Could not derive component name from file ${filename}`);
  }

  const base = value
    .replace(/%/g, 'u')
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

/**
 * webpack loader for sveltedoc-parser
 * @param source raw svelte component
 */
export default async function svelteDocgen(this: any, source: string) {
  // eslint-disable-next-line no-underscore-dangle
  const { resource } = this._module;
  const svelteOptions: any = this.getOptions();

  const { preprocess: preprocessOptions, logDocgen = false } = svelteOptions;

  let docOptions;
  if (preprocessOptions) {
    const src = fs.readFileSync(resource).toString();

    const { code: fileContent } = await preprocess(src, preprocessOptions);
    docOptions = {
      fileContent,
    };
  } else {
    docOptions = { filename: resource };
  }

  // set SvelteDoc options
  const options = {
    ...docOptions,
    version: 3,
  };

  let docgen = '';

  let componentDoc: any;
  try {
    // FIXME
    // @ts-expect-error (Converted from ts-ignore)
    componentDoc = await svelteDoc.parse(options);
  } catch (error) {
    componentDoc = { keywords: [], data: [] };
    if (logDocgen) {
      logger.error(error as any);
    }
  }

  // get filename for source content
  const file = path.basename(resource);

  // populate filename in docgen
  componentDoc.name = path.basename(file);

  const componentName = getNameFromFilename(resource);

  docgen = dedent`
      ${componentName}.__docgen = ${JSON.stringify(componentDoc)};
    `;

  // inject __docgen prop in svelte component
  const output = source + docgen;

  return output;
}
