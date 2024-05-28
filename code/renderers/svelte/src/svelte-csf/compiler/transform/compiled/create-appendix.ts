// TODO: Refactor, use Rollup parser (ESTree AST) to transform the output.

import url from 'node:url';
import MagicString from 'magic-string';

import { getNameFromStoryAttribute } from '../../../parser/analyse/Story-attributes.js';
import type { CompiledASTNodes } from '../../../parser/extract/compiled/nodes.js';
import type { SvelteASTNodes } from '../../../parser/extract/svelte/nodes.js';
import { extractStoryAttributesNodes } from '../../../parser/extract/svelte/Story-attributes.js';

const STORY_FNS_VARIABLE = '__storyFns';
const EXPORT_ORDER_VARIABLE = '__namedExportsOrder';

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


  const exportsOrder = await getStoriesNames({ nodes: svelte, filename });

  const storiesExports = exportsOrder
    .map((name) => {
      // TODO: There's probably some internal function in the Storybook to handle this?
      const variable = name.replace(/\s|\W/g, '');
      const objectKey = JSON.stringify(name);
      return `export const ${variable} = ${STORY_FNS_VARIABLE}[${objectKey}];`;
    })
    .join('\n');

  const metaIdentifier = getMetaIdentifier({
    node: defineMetaVariableDeclaration,
    filename,
  });

  // TODO: Create AST Nodes and stringify it.
  const appendix = [
    '', // NOTE: Adds a new line at the end of the code
    // the export is defined in the package.json export map
    `import { createStoryFns } from '@storybook/addon-svelte-csf/internal/create-story-fns';`,
    `const ${STORY_FNS_VARIABLE} = createStoryFns(${componentName}, ${metaIdentifier});`,
    `export default ${metaIdentifier};`,
    `export const ${EXPORT_ORDER_VARIABLE} = ${JSON.stringify(exportsOrder)};`,
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
