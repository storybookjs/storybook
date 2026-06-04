import { expect, within } from 'storybook/test';

import {
  buildReviewChangesDetailHref,
  buildReviewChangesSummaryHref,
} from '../review-navigation.ts';
import preview from '../../../../.storybook/preview.tsx';
import { DetailsScreen } from './DetailsScreen.tsx';

const meta = preview.meta({
  component: DetailsScreen,
  parameters: { layout: 'fullscreen' },
  args: {
    title: 'Guide Page',
    componentTitle: 'Manager/Settings/GuidePage',
    storyName: 'Default',
    storyId: 'manager-settings-guidepage--default',
    storyIndex: 1,
    totalStories: 3,
    backHref: buildReviewChangesSummaryHref(),
    previousHref: buildReviewChangesDetailHref({
      kind: 'collection',
      collectionIndex: 0,
      storyId: 'components-toolbar--compact',
    }),
    nextHref: buildReviewChangesDetailHref({
      kind: 'collection',
      collectionIndex: 0,
      storyId: 'components-toolbar--dense',
    }),
  },
});

export const Default = meta.story({
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('button', { name: '2/3' })).toBeInTheDocument();
    await expect(await canvas.findByText('GuidePage')).toBeInTheDocument();
    await expect(await canvas.findByText('Default')).toBeInTheDocument();
    await expect(
      await canvas.findByTitle('Baseline manager-settings-guidepage--default')
    ).toBeInTheDocument();
    await expect(
      await canvas.findByTitle('Latest manager-settings-guidepage--default')
    ).toBeInTheDocument();
    await expect(canvas.queryByText('New')).not.toBeInTheDocument();
    // Baseline existence is known up front, so the comparison bar renders
    // immediately — without waiting for the baseline iframe's load event.
    await expect(
      await canvas.findByRole('button', { name: 'Side-by-side preview mode' })
    ).toBeInTheDocument();
  },
});

export const NewStory = meta.story({
  args: {
    isNew: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('New')).toBeInTheDocument();
    await expect(
      await canvas.findByTitle('Latest manager-settings-guidepage--default')
    ).toBeInTheDocument();
    // A new story has no baseline to compare against: no baseline preview, no
    // side-by-side toggle, no bottom comparison bar.
    await expect(
      canvas.queryByTitle('Baseline manager-settings-guidepage--default')
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole('button', { name: 'Side-by-side preview mode' })
    ).not.toBeInTheDocument();
  },
});

export const Stale = meta.story({
  args: { isStale: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText('This review may be stale. Ask your agent to refresh it.')
    ).toBeInTheDocument();
  },
});

export const WrapAroundNavigation = meta.story({
  args: {
    storyId: 'manager-settings-guidepage--default',
    storyIndex: 0,
    totalStories: 3,
    previousHref: buildReviewChangesDetailHref({
      kind: 'collection',
      collectionIndex: 0,
      storyId: 'components-toolbar--dense',
    }),
    nextHref: buildReviewChangesDetailHref({
      kind: 'collection',
      collectionIndex: 0,
      storyId: 'components-toolbar--basic',
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const previousButton = await canvas.findByRole('link', { name: 'Previous story' });
    const nextButton = await canvas.findByRole('link', { name: 'Next story' });
    await expect(previousButton.getAttribute('href')).toContain(
      '/review/collections/0/components-toolbar--dense'
    );
    await expect(nextButton.getAttribute('href')).toContain(
      '/review/collections/0/components-toolbar--basic'
    );
  },
});
