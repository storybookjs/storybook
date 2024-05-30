import type { Attribute } from 'svelte/compiler';

import { getStringValueFromAttribute } from '../attributes.js';
import type { SvelteASTNodes } from '../../../extract/svelte/nodes.js';
import { extractStoryAttributesNodes } from '../../../extract/svelte/Story/attributes.js';
import { isValidVariableName, storyNameToExportName } from '../../../../utils/identifier-utils.js';
import dedent from 'dedent';

type StoryIdentifiers = {
  exportName: string;
  name: string | undefined;
};

interface GetIdentifiersParams {
  nameNode?: Attribute | undefined;
  exportNameNode?: Attribute | undefined;
  filename?: string;
}

export function getStoryIdentifiers(options: GetIdentifiersParams): StoryIdentifiers {
  const { nameNode, exportNameNode, filename } = options;

  let exportName = getStringValueFromAttribute({ node: exportNameNode, filename });
  const name = getStringValueFromAttribute({ node: nameNode, filename });

  if (!exportName) {
    if (!name) {
      throw new Error(
        `Missing 'name' or 'exportName' prop in a <Story /> definition in the '${filename}' file. All stories must either have a 'name' or an 'exportName' prop.`
      );
    }
    exportName = storyNameToExportName(name);
  }


  if(!isValidVariableName(exportName)) {
    throw new Error(dedent`Invalid exportName '${exportName}' found in <Story /> component in '${filename}'.
    exportName must be a valid JavaScript variable name. It must start with a letter, $ or _, followed by letters, numbers, $ or _.
    Reserved words like 'default' are also not allowed (see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar#reserved_words)
    `);
  }

  return {
    name,
    exportName,
  };
}

interface GetStoriesIdentifiersParams {
  nodes: SvelteASTNodes;
  filename?: string;
}

export function getStoriesIdentifiers(params: GetStoriesIdentifiersParams): StoryIdentifiers[] {
  const { nodes, filename } = params;
  const { storyComponents } = nodes;
  const allIdentifiers: StoryIdentifiers[] = [];

  for (const story of storyComponents) {
    const { exportName, name } = extractStoryAttributesNodes({
      component: story.component,
      filename,
      attributes: ['exportName', 'name'],
    });

    const identifiers = getStoryIdentifiers({
      exportNameNode: exportName,
      nameNode: name,
      filename,
    });

    const duplicateIdentifiers = allIdentifiers.find(
      (existingIdentifiers) => existingIdentifiers.exportName === identifiers.exportName
    );

    if(duplicateIdentifiers) {
      throw new Error(dedent`Duplicate exportNames found between two <Story /> definitions in '${filename}':
      First instance: <Story name=${duplicateIdentifiers.name ? `"${duplicateIdentifiers.name}"` : '{undefined}'} exportName="${duplicateIdentifiers.exportName}" ... />
      Second instance: <Story name=${identifiers.name ? `"${identifiers.name}"` : '{undefined}'} exportName="${identifiers.exportName}" ... />

      This can happen when 'exportName' is implicitly derived by 'name'. Complex names will be simplified to a PascalCased, valid JavaScript variable name,
      eg. 'Some story name!!' will be converted to 'SomeStoryName'.
      You can fix this collision by providing a unique 'exportName' prop with <Story exportName="SomeUniqueExportName" ... />.
      `);
    }

    allIdentifiers.push(identifiers);
  }

  return allIdentifiers;
}
