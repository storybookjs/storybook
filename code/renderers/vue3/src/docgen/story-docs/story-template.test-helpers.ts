import { expect } from 'vitest';

import {
  type ESTreeNode,
  createStoryArgsResolver,
  loadCsf,
  unwrapExpression,
} from 'storybook/internal/csf-tools';
import { writtenArg } from 'storybook/internal/docs-tools';
import type { StoryDocsPayload } from 'storybook/internal/types';

import { fillTemplate } from '../../docs/fill-template.ts';

/**
 * Expects each story's template, filled with the args the story writes as the preview fills it
 * while no control has changed them, to be the story's snippet.
 */
export function expectTemplatesFillToSnippets(payload: StoryDocsPayload, storyFile: string) {
  const csf = loadCsf(storyFile, { makeTitle: (title) => title ?? 'Example' }).parse();
  const resolver = createStoryArgsResolver(csf);
  for (const [exportName, { id }] of Object.entries(csf._stories)) {
    const story = payload.stories[id];
    if (story?.template === undefined) {
      continue;
    }
    const args = Object.fromEntries(
      Object.entries(resolver.resolve(exportName).args).map(([name, node]) => [
        name,
        Object.hasOwn(story.argCode ?? {}, name)
          ? writtenArg(story.argCode![name]!)
          : literalValue(node),
      ])
    );
    expect(fillTemplate(story.template, args)).toBe(story.snippet);
  }
}

const literalValue = (node: ESTreeNode) => {
  const value = unwrapExpression(node);
  if (
    value.type === 'UnaryExpression' &&
    value.operator === '-' &&
    value.argument.type === 'Literal' &&
    typeof value.argument.value === 'number'
  ) {
    return -value.argument.value;
  }
  return value.type === 'Literal' ? value.value : undefined;
};
