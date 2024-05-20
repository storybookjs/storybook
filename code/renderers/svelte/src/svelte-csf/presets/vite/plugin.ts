import url from 'node:url';
import fs from 'node:fs';

import type { SvelteConfig } from '@sveltejs/vite-plugin-svelte';
import MagicString from 'magic-string';
import { createFilter, type Plugin } from 'vite';
import { preprocess } from 'svelte/compiler';

import { getNameFromFilename } from '../svelte/stories-loader.js';
import { extractStories } from '../../parser/extract-stories.js';

const parser = url
  .fileURLToPath(new URL('../../parser/collect-stories.js', import.meta.url))
  .replace(/\\/g, '\\\\'); // For Windows paths

export default function plugin(svelteOptions: SvelteConfig): Plugin {
  const include = /\.stories\.svelte$/;
  const filter = createFilter(include);

  return {
    name: 'storybook:addon-svelte-csf-plugin',
    enforce: 'post',
    async transform(code, id) {
      if (!filter(id)) return undefined;

      const s = new MagicString(code);

      // NOTE:
      // The `meta` will be modified while extracting stories.
      // For reasons such as adding the `description`
      // from the leading comment above `export const meta`, and so on.
      s.replace('export default', '// export default');

      const component = getNameFromFilename(id);
      let source = fs.readFileSync(id).toString();

      if (svelteOptions && svelteOptions.preprocess) {
        source = (
          await preprocess(source, svelteOptions.preprocess, {
            filename: id,
          })
        ).code;
      }

      const storiesFileMeta = extractStories(source);
      const { module, fragment } = storiesFileMeta;
      const { stories } = fragment;
      const parsedStoriesVariable = '__parsed';
      const exportsOrderVariable = '__exports';
      const exportsOrder = Object.entries(stories).map(([id, _]) => id);
      const storiesExports = Object.entries(stories)
        .map(
          ([id]) =>
            `export const ${sanitizeStoryId(
              id
            )} = ${parsedStoriesVariable}.stories[${JSON.stringify(id)}];`
        )
        .join('\n');

      // biome-ignore format: Stop
      // prettier-ignore
      const output = [
				"",
				`import parser from '${parser}';`,
				`const ${parsedStoriesVariable} = parser(${component}, ${JSON.stringify(storiesFileMeta)}, ${module.addonMetaVarName});`,
				// NOTE:
				// Export default "modified" meta,
				// after combining with data extracted from the static analytics.
				`export default ${parsedStoriesVariable}.meta;`,
				`export const ${exportsOrderVariable} = ${JSON.stringify(exportsOrder)};`,
				storiesExports,
			].join("\n");

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
