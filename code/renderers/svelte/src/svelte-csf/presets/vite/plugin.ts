import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

import type { SvelteConfig } from '@sveltejs/vite-plugin-svelte';
import MagicString from 'magic-string';
import { createFilter, type Plugin } from 'vite';
import { preprocess } from 'svelte/compiler';

import { getNameFromFilename } from '../svelte/stories-loader.js';
import { extractStories } from '../../parser/extract-stories.js';

const parser = fileURLToPath(new URL('../../parser/collect-stories.js', import.meta.url)).replace(
  /\\/g,
  '\\\\'
); // For Windows paths

export default function plugin(svelteOptions: SvelteConfig): Plugin {
  const include = /\.stories\.svelte$/;
  const filter = createFilter(include);

  return {
    name: 'storybook:addon-svelte-csf-plugin',
    enforce: 'post',
    async transform(code, id) {
      if (!filter(id)) return undefined;

      const s = new MagicString(code);
      const component = getNameFromFilename(id);

      let source = readFileSync(id).toString();

      if (svelteOptions && svelteOptions.preprocess) {
        source = (
          await preprocess(source, svelteOptions.preprocess, {
            filename: id,
          })
        ).code;
      }

      const storiesFileMeta = extractStories(source);
      const { fragment } = storiesFileMeta;
      const { stories } = fragment;
      // biome-ignore format: Stop
      const storiesExports = Object.entries(stories)
        .map(
          ([id]) =>
            `export const ${sanitizeStoryId(id)} = __storiesMetaData.stories[${JSON.stringify(id)}];`
        )
        .join('\n');

      // FIXME: Still needed?
      // s.replace("export default", "// export default");

      const namedExportsOrder = Object.entries(stories).map(([id, _]) => id);

      const output = [
        '',
        `import parser from '${parser}';`,
        `const __storiesMetaData = parser(${component}, ${JSON.stringify(storiesFileMeta)}, meta);`,
        `export const __namedExportsOrder = ${JSON.stringify(namedExportsOrder)};`,
        storiesExports,
      ].join('\n');

      s.append(output);

      return {
        code: s.toString(),
        map: s.generateMap({ hires: true, source: id }),
      };
    },
  };
}

// FIXME: There's probably some interal function inside the Storybook to handle it
function sanitizeStoryId(id: string) {
  return id.replace(/\s|-/g, '_');
}
