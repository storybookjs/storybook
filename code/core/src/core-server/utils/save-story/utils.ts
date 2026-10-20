import type { CsfFile, CsfMutationResult, CsfObject } from 'storybook/internal/csf-tools';

export class SaveStoryError extends Error {}

export const findStory = (csf: CsfFile, exportName: string): CsfObject => {
  const isStory = ({ target }: { target: CsfObject['target'] }) =>
    target.kind === 'story' && target.exportName === exportName;
  const objects = csf.objects({ meta: false });
  // A second export of a story holds its first export's object, so saving it edits that object.
  const alias = csf.mutationDiagnostics.find(
    (diagnostic) => diagnostic.code === 'aliased-story' && isStory(diagnostic)
  )?.target;
  const story = objects.find(
    ({ target }) =>
      target.kind === 'story' &&
      (target.exportName === exportName ||
        (alias?.kind === 'story' && target.localName === alias.localName))
  );
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
