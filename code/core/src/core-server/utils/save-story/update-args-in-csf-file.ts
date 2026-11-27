import type { CsfFile, CsfValue, ESTree } from 'storybook/internal/csf-tools';

import { isValidIdentifier } from '../../../csf-tools/estree/ast.ts';
import { SaveStoryError, assertApplied, findStory } from './utils.ts';

// Edits accumulate on `csf`; print them with `printCsf`.
export const updateArgsInCsfFile = (
  csf: CsfFile,
  exportName: string,
  args: Record<string, CsfValue<ESTree.Expression>>
) => {
  for (const key of Object.keys(args)) {
    if (!isValidIdentifier(key, false)) {
      throw new SaveStoryError(`Invalid arg name: ${JSON.stringify(key)}`);
    }
  }
  const story = findStory(csf, exportName);
  csf.transaction(() => {
    for (const [key, value] of Object.entries(args)) {
      assertApplied(exportName, story.set(['args', key], value));
    }
  });
};
