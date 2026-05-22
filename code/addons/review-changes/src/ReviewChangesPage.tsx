import React, { type FC, useEffect, useState } from 'react';

import { useChannel } from 'storybook/manager-api';

import { REVIEW_CHANGES_URL } from './constants.ts';
import { EVENTS } from './constants.ts';
import type { ReviewState } from './review-state.ts';
import {
  buildReviewChangesDetailsHref,
  parseReviewChangesDetailsLocation,
} from './review-navigation.ts';
import { DetailsScreen } from './screens/DetailsScreen.tsx';
import { SummaryScreen } from './screens/SummaryScreen.tsx';

// Container — wires the channel + manager api. The agent pushes a review via
// the MCP addon; we cache nothing here, just reflect the latest pushed state.
export const ReviewChangesPage: FC = () => {
  const [state, setState] = useState<ReviewState | null>(null);

  const emit = useChannel({
    [EVENTS.APPLY_REVIEW_STATE]: (next: ReviewState) => setState(next),
  });

  // Late/refreshed tab: ask the server to replay the cached overlay.
  useEffect(() => {
    emit(EVENTS.REQUEST_REVIEW_STATE);
  }, [emit]);

  const detailsLocation = parseReviewChangesDetailsLocation(window.location.search);
  const collection = state?.collections[detailsLocation?.collectionIndex ?? -1];
  const totalStories = collection?.storyIds.length ?? 0;
  const hasDetailsState = !!collection && totalStories > 0 && detailsLocation !== null;

  if (hasDetailsState) {
    const normalizedStoryIndex = detailsLocation.storyIndex % totalStories;
    const previousStoryIndex = (normalizedStoryIndex - 1 + totalStories) % totalStories;
    const nextStoryIndex = (normalizedStoryIndex + 1) % totalStories;
    const currentStoryId = collection.storyIds[normalizedStoryIndex];

    return (
      <DetailsScreen
        collectionTitle={collection.title}
        storyId={currentStoryId}
        storyIndex={normalizedStoryIndex}
        totalStories={totalStories}
        backHref={REVIEW_CHANGES_URL}
        previousHref={buildReviewChangesDetailsHref({
          collectionIndex: detailsLocation.collectionIndex,
          storyIndex: previousStoryIndex,
        })}
        nextHref={buildReviewChangesDetailsHref({
          collectionIndex: detailsLocation.collectionIndex,
          storyIndex: nextStoryIndex,
        })}
        branchName={state?.branchName}
      />
    );
  }

  return <SummaryScreen state={state} />;
};
