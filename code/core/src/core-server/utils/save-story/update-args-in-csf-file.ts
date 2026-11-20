import type { CsfFile, CsfValue, ESTree } from 'storybook/internal/csf-tools';

import { assertApplied, findStory } from './utils.ts';

// Edits accumulate on `csf`; print them with `printCsf`.
export const updateArgsInCsfFile = (
  csf: CsfFile,
  exportName: string,
  args: Record<string, CsfValue<ESTree.Expression>>
) => {
  const story = findStory(csf, exportName);
  csf.transaction(() => {
    for (const [key, value] of Object.entries(args)) {
      assertApplied(exportName, story.set(['args', key], value));
    }
  });
};
