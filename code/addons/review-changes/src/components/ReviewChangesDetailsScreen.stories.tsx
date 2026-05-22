import { expect, within } from 'storybook/test';

import { REVIEW_CHANGES_URL } from '../constants.ts';
import { buildReviewChangesDetailsHref } from '../review-navigation.ts';
import preview from '../../../../.storybook/preview.tsx';
import { ReviewChangesDetailsScreen } from './ReviewChangesDetailsScreen.tsx';

const meta = preview.meta({
  component: ReviewChangesDetailsScreen,
  parameters: { layout: 'fullscreen' },
  args: {
    collectionTitle: 'Checklist',
    storyId: 'manager-settings-checklist--default',
    storyIndex: 1,
    totalStories: 3,
    backHref: REVIEW_CHANGES_URL,
    previousHref: buildReviewChangesDetailsHref({ collectionIndex: 0, storyIndex: 0 }),
    nextHref: buildReviewChangesDetailsHref({ collectionIndex: 0, storyIndex: 2 }),
    branchName: 'update/button-weight-and-padding',
  },
});

export const Default = meta.story({
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('button', { name: '2/3' })).toBeInTheDocument();
    await expect(
      await canvas.findByText('Core Button - primary/solid variant')
    ).toBeInTheDocument();
    await expect(
      await canvas.findByText('Latest on update/button-weight-and-padding')
    ).toBeInTheDocument();
  },
});

export const WrapAroundNavigation = meta.story({
  args: {
    storyId: 'manager-settings-checklist--default',
    storyIndex: 0,
    totalStories: 3,
    previousHref: buildReviewChangesDetailsHref({ collectionIndex: 0, storyIndex: 2 }),
    nextHref: buildReviewChangesDetailsHref({ collectionIndex: 0, storyIndex: 1 }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const previousButton = await canvas.findByRole('link', { name: 'Previous story' });
    const nextButton = await canvas.findByRole('link', { name: 'Next story' });
    await expect(previousButton.getAttribute('href')).toContain('story=2');
    await expect(nextButton.getAttribute('href')).toContain('story=1');
  },
});
