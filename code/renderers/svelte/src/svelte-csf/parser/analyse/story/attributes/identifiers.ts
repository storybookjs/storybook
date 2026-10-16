import { getLiteralValueFromAttribute, getStringValueFromAttribute } from '../attributes.ts';
import type { SvelteAST } from '../../../ast.ts';
import type { SvelteASTNodes } from '../../../extract/svelte/nodes.ts';
import { extractStoryAttributesNodes } from '../../../extract/svelte/story/attributes.ts';
import { isValidVariableName, storyNameToExportName } from '../../../../utils/identifier-utils.ts';
import {
  DuplicateStoryIdentifiersError,
  InvalidStoryExportNameError,
  NoStoryIdentifierError,
} from '../../../../utils/error/parser/analyse/story.ts';

type StoryIdentifiers = {
  exportName: string;
  name: string | undefined;
};

interface GetIdentifiersParams {
  nameNode?: SvelteAST.Attribute | undefined;
  exportNameNode?: SvelteAST.Attribute | undefined;
  filename?: string;
  component: SvelteAST.Component;
}

export function getStoryIdentifiers(options: GetIdentifiersParams): StoryIdentifiers {
  const { nameNode, exportNameNode, filename, component } = options;

  // Unlike `name`, `exportName` may be any literal: a falsy one means "derive it from `name`", and
  // any other non-string is an invalid export name.
  const exportNameValue = getLiteralValueFromAttribute({
    node: exportNameNode,
    filename,
    component,
  });
  const name = getStringValueFromAttribute({
    node: nameNode,
    filename,
    component,
  });
  let exportName: string;

  if (!exportNameValue) {
    if (!name) {
      throw new NoStoryIdentifierError({
        component,
        filename,
      });
    }
    exportName = storyNameToExportName(name);
  } else if (typeof exportNameValue === 'string') {
    exportName = exportNameValue;
  } else {
    throw new InvalidStoryExportNameError({
      filename,
      component,
      value: String(exportNameValue),
    });
  }

  if (!isValidVariableName(exportName)) {
    throw new InvalidStoryExportNameError({
      filename,
      component,
      value: exportName,
    });
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
      component: story.component,
    });

    const duplicateIdentifiers = allIdentifiers.find(
      (existingIdentifiers) => existingIdentifiers.exportName === identifiers.exportName
    );

    if (duplicateIdentifiers) {
      throw new DuplicateStoryIdentifiersError({
        filename,
        identifiers,
        duplicateIdentifiers,
      });
    }

    allIdentifiers.push(identifiers);
  }

  return allIdentifiers;
}
