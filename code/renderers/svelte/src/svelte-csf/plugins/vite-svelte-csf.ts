import * as svelte from 'svelte/compiler';

import MagicString from 'magic-string';
import { createFilter } from 'vite';
import { extractStories } from '../parser/extract-stories.js';
import { fileURLToPath } from 'url';
import { getNameFromFilename } from '../parser/svelte-stories-loader.js';
import { readFileSync } from 'fs';

const parser = fileURLToPath(new URL('../parser/collect-stories.js', import.meta.url))
  .replace(/\\/g, "\\\\"); // For Windows paths

export default function csfPlugin(svelteOptions) {
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
        source = (await svelte.preprocess(source, svelteOptions.preprocess, { filename: id })).code;
      }
      const all = extractStories(source);
      const { stories } = all;
      const storyDef = Object.entries(stories)
        .filter(([, def]) => !def.template)
        .map(
          ([storyId]) =>
            `export const ${storyId} = __storiesMetaData.stories[${JSON.stringify(storyId)}];`
        )
        .join('\n');

      s.replace('export default', '// export default');

      const namedExportsOrder = Object.entries(stories)
        .filter(([, def]) => !def.template)
        .map(([storyId]) => storyId);

      const output = [
        '',
        `import parser from '${parser}';`,
        `const __storiesMetaData = parser(${component}, ${JSON.stringify(all)});`,
        'export default __storiesMetaData.meta;',
        `export const __namedExportsOrder = ${JSON.stringify(namedExportsOrder)};`,
        storyDef,
      ].join('\n');

      s.append(output);

      return {
        code: s.toString(),
        map: s.generateMap({ hires: true, source: id }),
      };
    },
  };
}
