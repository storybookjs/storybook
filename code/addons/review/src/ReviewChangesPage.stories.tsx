import { expect, fn, userEvent, within } from 'storybook/test';

import preview from '../../../.storybook/preview.tsx';
import { EVENTS } from './constants.ts';
import type { ReviewState } from './review-state.ts';
import { ReviewChangesPage, type ReviewChangesPageProps } from './ReviewChangesPage.tsx';

let registeredEventMap: Record<string, ((payload: ReviewState) => void) | undefined> = {};
const emitMock = fn();

const useChannelMock: NonNullable<ReviewChangesPageProps['useChannelHook']> = (eventMap) => {
  registeredEventMap = eventMap as typeof registeredEventMap;
  return emitMock as ReturnType<NonNullable<ReviewChangesPageProps['useChannelHook']>>;
};

const reviewState: ReviewState = {
  title: 'Manager settings polish',
  description: 'Updated settings views and spacing.',
  branchName: 'feat/review-page',
  collections: [
    {
      title: 'Settings',
      rationale: 'Primary settings surfaces changed.',
      storyIds: [
        'manager-settings-checklist--default',
        'manager-settings-guidepage--default',
        'manager-settings-aboutscreen--default',
      ],
    },
  ],
};

const applyReviewState = () => {
  const applyEventHandler = registeredEventMap[EVENTS.APPLY_REVIEW_STATE];
  expect(applyEventHandler).toBeTruthy();
  applyEventHandler?.(reviewState);
};

const meta = preview.meta({
  component: ReviewChangesPage,
  parameters: { layout: 'fullscreen' },
  args: {
    useChannelHook: useChannelMock,
    locationSearch: '',
  },
  beforeEach: () => {
    registeredEventMap = {};
    emitMock.mockReset();
  },
});

export const Collections = meta.story({
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(/Waiting for the agent/i)).toBeInTheDocument();
    await expect(emitMock).toHaveBeenCalledWith(EVENTS.REQUEST_REVIEW_STATE);

    applyReviewState();

    await expect(await canvas.findByText('Manager settings polish')).toBeInTheDocument();
    await expect(await canvas.findByRole('tab', { name: 'Collections' })).toBeInTheDocument();
  },
});

export const Components = meta.story({
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(emitMock).toHaveBeenCalledWith(EVENTS.REQUEST_REVIEW_STATE);

    applyReviewState();

    const componentsTab = await canvas.findByRole('tab', { name: 'Components' });
    await userEvent.click(componentsTab);

    await expect(await canvas.findByText('Components view coming soon.')).toBeInTheDocument();
  },
});

export const Details = meta.story({
  args: {
    locationSearch: '?collection=0&story=1',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(emitMock).toHaveBeenCalledWith(EVENTS.REQUEST_REVIEW_STATE);

    applyReviewState();

    await expect(await canvas.findByText('Settings')).toBeInTheDocument();
    await expect(await canvas.findByRole('button', { name: '2/3' })).toBeInTheDocument();
    await expect(await canvas.findByText('Latest on feat/review-page')).toBeInTheDocument();
  },
});
