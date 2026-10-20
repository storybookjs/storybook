import type { CsfFile, CsfMutationResult, CsfObject } from 'storybook/internal/csf-tools';

export class SaveStoryError extends Error {}

export const findStory = (csf: CsfFile, exportName: string): CsfObject => {
  const found = csf.storyObject(exportName);
  if (!found) {
    throw new SaveStoryError(`Cannot edit story ${exportName} automatically`);
  }
  if (!found.ok) {
    throw new SaveStoryError(found.diagnostic.message);
  }
  return found.object;
};

export const assertApplied = (result: CsfMutationResult) => {
  if (!result.ok) {
    throw new SaveStoryError(result.diagnostic.message);
  }
};
