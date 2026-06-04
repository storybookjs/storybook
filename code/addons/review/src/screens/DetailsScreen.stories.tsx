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
    title: 'Toolbar & direct consumers',
    componentTitle: 'Manager/Components/Toolbar',
    storyName: 'Basic',
    storyId: 'components-toolbar--basic',
    storyIndex: 1,
    totalStories: 3,
    backHref: buildReviewChangesSummaryHref(),
    previousHref: buildReviewChangesDetailHref({
      collectionIndex: 0,
      storyId: 'components-toolbar--compact',
    }),
    nextHref: buildReviewChangesDetailHref({
      collectionIndex: 0,
      storyId: 'components-toolbar--dense',
    }),
  },
});

export const Default = meta.story({
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('button', { name: '2/3' })).toBeInTheDocument();
    await expect(
      await canvas.findByRole('heading', { name: 'Toolbar & direct consumers' })
    ).toBeInTheDocument();
    await expect(await canvas.findByText('Toolbar')).toBeInTheDocument();
    await expect(await canvas.findByText('Basic')).toBeInTheDocument();
    await expect(
      await canvas.findByRole('link', { name: 'View in Storybook' })
    ).toBeInTheDocument();
  },
});

export const WithBaseline = meta.story({
  args: {
    hasBaseline: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Baseline')).toBeInTheDocument();
    await expect(await canvas.findByText('Latest')).toBeInTheDocument();
    await expect(
      await canvas.findByRole('button', { name: 'Side-by-side view' })
    ).toBeInTheDocument();
  },
});

export const WrapAroundNavigation = meta.story({
  args: {
    storyId: 'components-toolbar--basic',
    storyIndex: 0,
    totalStories: 3,
    previousHref: buildReviewChangesDetailHref({
      collectionIndex: 0,
      storyId: 'components-toolbar--dense',
    }),
    nextHref: buildReviewChangesDetailHref({
      collectionIndex: 0,
      storyId: 'components-toolbar--basic',
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const previousButton = await canvas.findByRole('link', { name: 'Previous story' });
    const nextButton = await canvas.findByRole('link', { name: 'Next story' });
    await expect(previousButton.getAttribute('href')).toContain(
      '/review/0/components-toolbar--dense'
    );
    await expect(nextButton.getAttribute('href')).toContain('/review/0/components-toolbar--basic');
  },
});
