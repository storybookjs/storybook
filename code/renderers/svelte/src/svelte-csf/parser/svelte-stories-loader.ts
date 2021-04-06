import dedent from 'ts-dedent';
import { readFileSync } from 'fs';

import { extractStories } from './extract-stories';

const parser = require.resolve('./collect-stories').replace(/[/\\]/g, '/');

// From https://github.com/sveltejs/svelte/blob/8db3e8d0297e052556f0b6dde310ef6e197b8d18/src/compiler/compile/utils/get_name_from_filename.ts
// Copied because it is not exported from the compiler
export function getNameFromFilename(filename: string) {
  if (!filename) return null;

  const parts = filename.split(/[/\\]/).map(encodeURI);

  if (parts.length > 1) {
    const index_match = parts[parts.length - 1].match(/^index(\.\w+)/);
    if (index_match) {
      parts.pop();
      parts[parts.length - 1] += index_match[1];
    }
  }

  const base = parts
    .pop()
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

function transformSvelteStories(code: string) {
  // eslint-disable-next-line no-underscore-dangle
  const { resource } = this._module;

  const componentName = getNameFromFilename(resource);

  const source = readFileSync(resource).toString();

  const storiesDef = extractStories(source);
  const { stories } = storiesDef;

  const storyDef = Object.entries(stories)
    .filter(([, def]) => !def.template)
    .map(([id]) => `export const ${id} = __storiesMetaData.stories[${JSON.stringify(id)}]`)
    .join('\n');

  const codeWithoutDefaultExport = code.replace('export default ', '//export default');

  return dedent`${codeWithoutDefaultExport}
    const { default: parser } = require('${parser}');
    const __storiesMetaData = parser(${componentName}, ${JSON.stringify(storiesDef)});
    export default __storiesMetaData.meta;
    ${storyDef};
  `;
}

export default transformSvelteStories;
