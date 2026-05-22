import { REVIEW_CHANGES_URL } from './constants.ts';

export interface ReviewChangesDetailsLocation {
  collectionIndex: number;
  storyIndex: number;
}

export const buildReviewChangesDetailsHref = ({
  collectionIndex,
  storyIndex,
}: ReviewChangesDetailsLocation) =>
  `${REVIEW_CHANGES_URL}?collection=${collectionIndex}&story=${storyIndex}`;

export const parseReviewChangesDetailsLocation = (
  search: string
): ReviewChangesDetailsLocation | null => {
  const params = new URLSearchParams(search);
  const collectionIndex = Number(params.get('collection'));
  const storyIndex = Number(params.get('story'));

  if (
    !Number.isInteger(collectionIndex) ||
    !Number.isInteger(storyIndex) ||
    collectionIndex < 0 ||
    storyIndex < 0
  ) {
    return null;
  }

  return { collectionIndex, storyIndex };
};
