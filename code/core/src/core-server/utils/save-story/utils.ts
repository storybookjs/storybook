import type { CsfFile, CsfMutationResult, CsfObject } from 'storybook/internal/csf-tools';

export class SaveStoryError extends Error {}

export const findStory = (csf: CsfFile, exportName: string): CsfObject => {
  const isStory = ({ target }: { target: CsfObject['target'] }) =>
    target.kind === 'story' && target.exportName === exportName;
  const story = csf.objects({ meta: false }).find(isStory);
  if (!story) {
    throw new SaveStoryError(
      csf.mutationDiagnostics.findLast(isStory)?.message ??
        `Cannot edit story ${exportName} automatically`
    );
  }
  return story;
};

export const assertApplied = (result: CsfMutationResult) => {
  if (!result.ok) {
    throw new SaveStoryError(result.diagnostic.message);
  }
};
