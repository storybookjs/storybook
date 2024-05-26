import url from 'node:url';
import MagicString from 'magic-string';

import type { AddonASTNodes, StoriesFileMeta } from '../parser/types.js';

const parserModulePath = url
  .fileURLToPath(new URL('../../../dist/utils/parser/collect-stories.js', import.meta.url))
  .replace(/\\/g, '\\\\'); // For Windows paths

export function createAppendix({
  componentName,
  code,
  storiesFileMeta,
  nodes,
}: {
  componentName: string;
  code: MagicString;
  storiesFileMeta: StoriesFileMeta;
  nodes: AddonASTNodes;
}) {
  const { stories } = storiesFileMeta;
  const { defineMetaVar } = nodes;
  const parsedStoriesVariable = '__parsed';
  const exportsOrderVariable = '__namedExportsOrder';

  // NOTE:
  // We need to remove the default export from the code,
  // because Storybook internally expects export default `meta`
  code.replace(/export default/, '');

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
    `const ${parsedStoriesVariable} = parser(${componentName}, ${JSON.stringify(storiesFileMeta)}, ${findMetaPropertyName(defineMetaVar) ?? "meta"});`,
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

function findMetaPropertyName(defineMetaVar: AddonASTNodes['defineMetaVar']) {
  const { declarations } = defineMetaVar;
  const { id } = declarations[0];

  if (id.type === 'ObjectPattern') {
    const { properties } = id;

    const property = properties.find(
      (p) => p.type === 'Property' && p.key.type === 'Identifier' && p.key.name === 'meta'
    );

    if (property && property.type === 'Property' && property.value.type === 'Identifier') {
      return property.value.name;
    }
  }
}
