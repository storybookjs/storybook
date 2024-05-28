// TODO: Refactor, use Rollup parser (ESTree AST) to transform the output.

import url from 'node:url';
import MagicString from 'magic-string';

import { getNameFromStoryAttribute } from '../../../utils/parser/analyse/Story-attributes.js';
import type { SvelteASTNodes } from '../../../utils/parser/extract/svelte/nodes.js';
import type { CompiledASTNodes } from '../../../utils/parser/extract/compiled/nodes.js';
import { extractStoryAttributesNodes } from '../../../utils/parser/extract/svelte/Story-attributes.js';

const parserModulePath = url
  .fileURLToPath(new URL('../../../utils/parser/collect-stories.js', import.meta.url))
  .replace(/\\/g, '\\\\'); // For Windows paths

interface Params {
  componentName: string;
  code: MagicString;
  nodes: {
    compiled: CompiledASTNodes;
    svelte: SvelteASTNodes;
  };
  filename: string;
}

export async function createAppendix(params: Params) {
  const { componentName, code, nodes, filename } = params;
  const { compiled, svelte } = nodes;
  const { defineMetaVariableDeclaration } = compiled;

  // NOTE:
  // We need to remove the default export from the code,
  // because Storybook internally expects export default `meta`
  code.replace(/export default /, '');

  const parsedStoriesVariable = '__parsed';
  const exportsOrderVariable = '__namedExportsOrder';

  const exportsOrder = await getStoriesNames({ nodes: svelte, filename });

  const storiesExports = exportsOrder
    .map((name) => {
      // TODO: There's probably some internal function in the Storybook to handle this?
      const variable = name.replace(/\s|\W/g, '');
      const objectKey = JSON.stringify(name);
      return `export const ${variable} = ${parsedStoriesVariable}.stories[${objectKey}];`;
    })
    .join('\n');

  const metaIdentifier = getMetaIdentifier({
    node: defineMetaVariableDeclaration,
    filename,
  });

  // TODO: Create AST Nodes and stringify it.
  const appendix = [
    '', // NOTE: Adds a new line at the end of the code
    `import parser from '${parserModulePath}';`,
    `const ${parsedStoriesVariable} = parser(${componentName}, ${metaIdentifier});`,
    `export default ${metaIdentifier};`,
    `export const ${exportsOrderVariable} = ${JSON.stringify(exportsOrder)};`,
    storiesExports,
  ].join('\n');

  code.append(appendix);
}

function getMetaIdentifier({
  node,
  filename,
}: {
  node: SvelteASTNodes['defineMetaVariableDeclaration'];
  filename: string;
}) {
  const { declarations } = node;
  const { id } = declarations[0];

  if (id.type !== 'ObjectPattern') {
    throw new Error();
  }

  const { properties } = id;

  const property = properties.find(
    (p) => p.type === 'Property' && p.key.type === 'Identifier' && p.key.name === 'meta'
  );

  if (!property || property.type !== 'Property' || property.value.type !== 'Identifier') {
    throw new Error(
      `Could not find the meta identifier in the output code for stories file: ${filename}`
    );
  }

  return property.value.name;
}

async function getStoriesNames({
  nodes,
  filename,
}: {
  nodes: SvelteASTNodes;
  filename: string;
}): Promise<string[]> {
  const { storyComponents } = nodes;
  const names: string[] = [];

  for (const story of storyComponents) {
    const { name } = await extractStoryAttributesNodes({
      component: story.component,
      filename,
      attributes: ['name'],
    });

    names.push(getNameFromStoryAttribute({ node: name, filename }));
  }

  return names;
}
