import { types as t } from 'storybook/internal/babel';
import type { collectImportBindings } from 'storybook/internal/csf-tools';
import {
  buildImportStatements,
  keyOf,
  resolveComponentImport,
  unwrapExpression,
} from 'storybook/internal/csf-tools';

import type { HostComponentSnippetInput } from './story-docs-snippet.ts';

export interface StoryNgModulesContext {
  metaNgModules: StoryNgModules;
  componentName: string | undefined;
  importBindings: ReturnType<typeof collectImportBindings>;
}

export interface StoryNgModules {
  names: string[];
  declaresComponent: boolean;
}

// The decorator is matched by its conventional local name: resolving the import binding would only
// rule out a foreign function that happens to be called `moduleMetadata`, which does not arise.
export const ngModulesFromDecorators = (
  decorators: t.Node | undefined,
  componentName: string | undefined
): StoryNgModules => {
  const result: StoryNgModules = { names: [], declaresComponent: false };
  const list = decorators === undefined ? undefined : unwrapExpression(decorators);
  if (!list || !t.isArrayExpression(list)) {
    return result;
  }
  for (const element of list.elements) {
    if (!element || t.isSpreadElement(element)) {
      continue;
    }
    const call = unwrapExpression(element);
    if (!t.isCallExpression(call) || !t.isIdentifier(call.callee, { name: 'moduleMetadata' })) {
      continue;
    }
    const [metadataArg] = call.arguments;
    const metadata =
      metadataArg && t.isExpression(metadataArg) ? unwrapExpression(metadataArg) : undefined;
    if (!metadata || !t.isObjectExpression(metadata)) {
      continue;
    }
    for (const property of metadata.properties) {
      if (!t.isObjectProperty(property) || !t.isExpression(property.value)) {
        continue;
      }
      const key = keyOf(property);
      const value = unwrapExpression(property.value);
      if ((key !== 'imports' && key !== 'declarations') || !t.isArrayExpression(value)) {
        continue;
      }
      for (const item of value.elements) {
        if (!item || t.isSpreadElement(item)) {
          continue;
        }
        const entry = unwrapExpression(item);
        if (!t.isIdentifier(entry)) {
          continue;
        }
        if (key === 'imports') {
          if (entry.name !== componentName && !result.names.includes(entry.name)) {
            result.names.push(entry.name);
          }
        } else if (entry.name === componentName) {
          result.declaresComponent = true;
        }
      }
    }
  }
  return result;
};

// A story that declares the component itself wires it without a module the snippet could name, so
// the builder's warning path stays the honest output.
export const storyNgModules = (
  storyDecorators: t.Node | undefined,
  { metaNgModules, componentName, importBindings }: StoryNgModulesContext
): HostComponentSnippetInput['ngModules'] => {
  const story = ngModulesFromDecorators(storyDecorators, componentName);
  if (metaNgModules.declaresComponent || story.declaresComponent) {
    return undefined;
  }
  const names = [...new Set([...metaNgModules.names, ...story.names])];
  // A module bound to no import is glue local to the story file, which a reader cannot obtain, so
  // it does not count as a module the snippet can claim.
  const refs = names
    .map((name) => resolveComponentImport(name, importBindings))
    .filter((ref) => ref.importId);
  if (refs.length === 0) {
    return undefined;
  }
  return {
    names: refs.map((ref) => ref.componentName),
    importStatements: buildImportStatements({ refs }),
  };
};
