import type { Attribute, Component } from 'svelte/compiler';

import { getStringValueFromAttribute } from '../attributes';

import type { SvelteASTNodes } from '#parser/extract/svelte/nodes';
import { extractStoryAttributesNodes } from '#parser/extract/svelte/story/attributes';
import { isValidVariableName, storyNameToExportName } from '#utils/identifier-utils';
import {
  DuplicateStoryIdentifiersError,
  InvalidStoryExportNameError,
  NoStoryIdentifierError,
} from '#utils/error/parser/analyse/story';

type StoryIdentifiers = {
  exportName: string;
  name: string | undefined;
};

interface GetIdentifiersParams {
  nameNode?: Attribute | undefined;
  exportNameNode?: Attribute | undefined;
  filename?: string;
  component: Component;
}

export function getStoryIdentifiers(options: GetIdentifiersParams): StoryIdentifiers {
  const { nameNode, exportNameNode, filename, component } = options;

  let exportName = getStringValueFromAttribute({
    node: exportNameNode,
    filename,
    component,
  });
  const name = getStringValueFromAttribute({
    node: nameNode,
    filename,
    component,
  });

  if (!exportName) {
    if (!name) {
      throw new NoStoryIdentifierError({
        component,
        filename,
      });
    }
    exportName = storyNameToExportName(name);
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
