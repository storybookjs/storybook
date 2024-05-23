import url from 'node:url';

import MagicString from 'magic-string';

import type { StoriesFileMeta } from 'src/parser/types.js';

const parserModulePath = url
  .fileURLToPath(new URL('../../dist/parser/collect-stories.js', import.meta.url))
  .replace(/\\/g, '\\\\'); // For Windows paths

export function createAppendix({
  code,
  componentName,
  storiesFileMeta,
}: {
  code: MagicString;
  componentName: string;
  storiesFileMeta: StoriesFileMeta;
}) {
  const { module, fragment } = storiesFileMeta;
  const { stories } = fragment;
  const parsedStoriesVariable = '__parsed';
  const exportsOrderVariable = '__exports';

  // NOTE:
  // We need to remove the default export from the code,
  // because Storybook internally expects export default `meta`
  code.replace(/export default .*\n/, '');

  const exportsOrder = Object.entries(stories).map(([id, _]) => id);
  // biome-ignore format: Stop
  // prettier-ignore
  const storiesExports = Object.entries(stories)
		.map(([id]) =>
      `export const ${sanitizeStoryId(id)} = ${parsedStoriesVariable}.stories[${JSON.stringify(id)}];`
		)
		.join("\n");

  // biome-ignore format: Stop
  // prettier-ignore
  const appendix = [
    "", // NOTE: Adds a new line at the end of the code
    `import parser from '${parserModulePath}';`,
    `const ${parsedStoriesVariable} = parser(${componentName}, ${JSON.stringify(storiesFileMeta)}, ${module.addonMetaVarName ?? "meta"});`,
    `export default ${parsedStoriesVariable}.meta;`,
    `export const ${exportsOrderVariable} = ${JSON.stringify(exportsOrder)};`,
    storiesExports,
  ].join("\n");

  code.append(appendix);

  return code;
}

// FIXME: There's probably some interal function inside the Storybook to handle it
function sanitizeStoryId(id: string) {
  return id.replace(/\s|-/g, '_');
}
