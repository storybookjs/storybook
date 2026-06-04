import React, { type FC, type ReactNode, useEffect, useRef, useState } from 'react';

import { expect, userEvent, within } from 'storybook/test';

import preview from '../../../../.storybook/preview.tsx';
import type { StoryInfo } from '../components/CollectionGrid.tsx';
import { REVIEW_CHANGES_URL } from '../constants.ts';
import {
  buildReviewChangesDetailHref,
  buildReviewChangesSummaryHref,
  parseReviewChangesDetailLocation,
} from '../review-navigation.ts';
import type { ReviewState } from '../review-state.ts';
import { DetailsScreen } from '../screens/DetailsScreen.tsx';
import { SummaryScreen } from '../screens/SummaryScreen.tsx';

// A story-friendly mirror of `ReviewChangesContent`: drives the same screens
// off a single piece of local state ("the URL search string") instead of the
// manager router, so internal navigation (thumbnails, prev/next, back)
// works end-to-end inside a Storybook preview iframe. The click handler
// captures plain <a href="?path=/review/…"> clicks, swallows them,
// and just updates the local search — no router, no manager-api required.
const ReviewFlowPrototype: FC<{
  state: ReviewState;
  storyInfo?: Record<string, StoryInfo>;
  initialSearch?: string;
}> = ({ state, storyInfo = {}, initialSearch = '' }) => {
  const [search, setSearch] = useState(initialSearch);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }
    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      // `event.target` can be a non-Element node (e.g. a Text node), which has
      // no `closest`; guard before treating it as an Element.
      const { target } = event;
      const anchor = target instanceof Element ? target.closest('a') : null;
      const href = anchor?.getAttribute('href');
      if (!href || !href.startsWith(`?path=${REVIEW_CHANGES_URL}`)) {
        return;
      }
      event.preventDefault();
      setSearch(href);
    };
    container.addEventListener('click', onClick);
    return () => container.removeEventListener('click', onClick);
  }, []);

  const detailLocation = parseReviewChangesDetailLocation(search);

  let detailScreen: ReactNode = null;
  if (detailLocation) {
    const collection = state.collections[detailLocation.collectionIndex];
    if (collection && collection.storyIds.length > 0) {
      const detailStoryIds = collection.storyIds;
      const totalStories = detailStoryIds.length;
      const resolvedIndexFromStoryId =
        detailLocation.storyId !== undefined
          ? detailStoryIds.findIndex((storyId) => storyId === detailLocation.storyId)
          : -1;
      const currentStoryIndex = resolvedIndexFromStoryId >= 0 ? resolvedIndexFromStoryId : 0;
      const previousStoryIndex = (currentStoryIndex - 1 + totalStories) % totalStories;
      const nextStoryIndex = (currentStoryIndex + 1) % totalStories;
      const currentStoryId = detailStoryIds[currentStoryIndex];
      const currentStoryInfo = storyInfo[currentStoryId];

      detailScreen = (
        <DetailsScreen
          title={collection.title}
          storyId={currentStoryId}
          storyIndex={currentStoryIndex}
          totalStories={totalStories}
          componentTitle={currentStoryInfo?.title}
          storyName={currentStoryInfo?.name}
          backHref={buildReviewChangesSummaryHref()}
          previousHref={buildReviewChangesDetailHref({
            collectionIndex: detailLocation.collectionIndex,
            storyId: detailStoryIds[previousStoryIndex],
          })}
          nextHref={buildReviewChangesDetailHref({
            collectionIndex: detailLocation.collectionIndex,
            storyId: detailStoryIds[nextStoryIndex],
          })}
          hasBaseline={state.hasBaseline ?? false}
        />
      );
    }
  }

  return (
    <div ref={containerRef} style={{ display: 'contents' }}>
      {detailScreen ?? <SummaryScreen state={state} storyInfo={storyInfo} />}
    </div>
  );
};

const buttonReview: ReviewState = {
  title: 'Primary button visual refresh',
  branchName: 'update/button-styles',
  description:
    'Bumped Button border-radius and font weight. Spot-check Button variants first, then the components that embed it.',
  collections: [
    {
      title: 'Button — atomic',
      rationale: 'Direct changes; verify every variant.',
      kind: 'atomic',
      storyIds: [
        'button-component--variants',
        'button-component--sizes',
        'button-component--paddings',
        'button-component--pseudo-states',
        'button-component--icon-only',
      ],
    },
    {
      title: 'Toolbar & Tabs — consumers',
      rationale: 'Embed Button directly; rounded corners are now more prominent.',
      kind: 'consumer',
      storyIds: [
        'components-toolbar--basic',
        'components-toolbar--scrollable',
        'components-tabs--stateful-static',
        'components-tabs--stateless-with-tools',
      ],
    },
  ],
};

const buttonStoryInfo: Record<string, StoryInfo> = {
  'button-component--variants': { title: 'Components/Button', name: 'Variants' },
  'button-component--sizes': { title: 'Components/Button', name: 'Sizes' },
  'button-component--paddings': { title: 'Components/Button', name: 'Paddings' },
  'button-component--pseudo-states': { title: 'Components/Button', name: 'Pseudo States' },
  'button-component--icon-only': { title: 'Components/Button', name: 'Icon Only' },
  'components-toolbar--basic': { title: 'Components/Toolbar', name: 'Basic' },
  'components-toolbar--scrollable': { title: 'Components/Toolbar', name: 'Scrollable' },
  'components-tabs--stateful-static': { title: 'Components/Tabs', name: 'Stateful Static' },
  'components-tabs--stateless-with-tools': {
    title: 'Components/Tabs',
    name: 'Stateless With Tools',
  },
};

const meta = preview.meta({
  component: ReviewFlowPrototype,
  parameters: { layout: 'fullscreen' },
  args: {
    state: buttonReview,
    storyInfo: buttonStoryInfo,
    initialSearch: '',
  },
});

// Default flow: land on the summary, drill into a story, page through with
// next, and back out to the summary.
export const Default = meta.story({
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(await canvas.findByText('Primary button visual refresh')).toBeInTheDocument();

    const [firstThumb] = await canvas.findAllByRole('link', { name: /Review story/ });
    await userEvent.click(firstThumb);

    await expect(await canvas.findByRole('link', { name: 'Back to review' })).toBeInTheDocument();

    await userEvent.click(await canvas.findByRole('link', { name: 'Next story' }));
    await userEvent.click(await canvas.findByRole('link', { name: 'Back to review' }));

    await expect(await canvas.findByText('Primary button visual refresh')).toBeInTheDocument();
  },
});

// Open straight onto the detail screen, as if a teammate had shared the
// deep link. Verifies the URL→view derivation in isolation.
export const StartingOnDetail = meta.story({
  args: {
    initialSearch: '?path=/review/0/button-component--sizes',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('button', { name: '2/5' })).toBeInTheDocument();
  },
});

// Search reduces the visible stories to a single match — clicking that one
// still lands on the correct detail page (story index resolves against the
// full collection list, not the filtered display list).
export const SearchThenNavigate = meta.story({
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const [input] = await canvas.findAllByPlaceholderText('Find stories');
    await userEvent.type(input, 'paddings');

    const [match] = await canvas.findAllByRole('link', { name: /Review story/ });
    await userEvent.click(match);

    await expect(await canvas.findByRole('link', { name: 'Back to review' })).toBeInTheDocument();
  },
});
