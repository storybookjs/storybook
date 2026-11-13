import React from 'react';

import { Button } from 'storybook/internal/components';
import { AI_PROMPT_NUDGE } from 'storybook/internal/core-events';
import { CHANGE_DETECTION_STATUS_TYPE_ID } from 'storybook/internal/types';

import { global } from '@storybook/global';
import { CheckIcon, WandIcon } from '@storybook/icons';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { MemoryRouter } from 'storybook/internal/router';
import { ManagerContext, internal_fullStatusStore } from 'storybook/manager-api';
import { expect, fn, mocked, spyOn, userEvent, waitFor } from 'storybook/test';

import { initialState as checklistInitialState } from '../../../shared/checklist-store/checklistData.state.ts';
import { useCopyButton } from '../../../shared/useCopyButton.ts';
import { UI_REVIEW_PROMPT } from '../../../shared/utils/ai-prompts.ts';
import {
  internal_universalChecklistStore as checklistStore,
  internal_universalReviewHintStore as reviewHintStore,
} from '../../manager-stores.mock.ts';
import { ReviewProvider } from '../review/components/ReviewProvider.tsx';
import { reviewServiceForStories as reviewService } from '../review/review-service-story-helpers.ts';
import { IconSymbols } from './IconSymbols.tsx';
import { ReviewHint, useChangedStoryCount } from './ReviewHint.tsx';
import { ShowChangesButton } from './ShowChangesButton.tsx';

const storyIds = ['s1', 's2', 's3'];

const emit = fn().mockName('api::emit');
const focusOnUIElement = fn().mockName('api::focusOnUIElement');

const managerContext: any = {
  state: {
    path: '/',
    viewMode: 'story',
    customQueryParams: {},
    includedStatusFilters: [],
    excludedStatusFilters: [],
    includedTagFilters: [],
    excludedTagFilters: [],
    internal_index: {
      v: 5,
      entries: Object.fromEntries(
        storyIds.map((id) => [
          id,
          {
            type: 'story',
            id,
            name: id,
            title: id,
            importPath: `./${id}.stories.tsx`,
            tags: ['dev'],
          },
        ])
      ),
    },
  },
  api: {
    on: fn().mockName('api::on'),
    off: fn().mockName('api::off'),
    once: fn().mockName('api::once'),
    emit,
    focusOnUIElement,
    navigate: fn().mockName('api::navigate'),
    setQueryParams: fn().mockName('api::setQueryParams'),
    addNotification: fn().mockName('api::addNotification'),
    clearNotification: fn().mockName('api::clearNotification'),
    getIsNavShown: () => true,
    // Used by the onboarding checklist, which the hint reads.
    getData: fn().mockName('api::getData'),
    getIndex: fn().mockName('api::getIndex'),
    getElements: fn(() => ({})),
    getDocsUrl: () => 'https://storybook.js.org/docs/',
    getUrlState: () => ({ path: '/', queryParams: {} }),
    getStoryHrefs: (storyId: string) => ({
      managerHref: `?path=/story/${storyId}`,
      previewHref: `iframe.html?id=${storyId}&viewMode=story`,
    }),
    setAllStatusFilters: fn().mockName('api::setAllStatusFilters'),
  },
};

const setChangedStories = () => {
  internal_fullStatusStore.set([
    {
      storyId: 's1',
      typeId: CHANGE_DETECTION_STATUS_TYPE_ID,
      value: 'status-value:new',
      title: 'Change Detection',
      description: '',
    },
    {
      storyId: 's2',
      typeId: CHANGE_DETECTION_STATUS_TYPE_ID,
      value: 'status-value:modified',
      title: 'Change Detection',
      description: '',
    },
  ]);
  return () => internal_fullStatusStore.unset();
};

const withConfigType = (configType: 'DEVELOPMENT' | 'PRODUCTION') => () => {
  const original = global.CONFIG_TYPE;
  global.CONFIG_TYPE = configType;
  return () => {
    global.CONFIG_TYPE = original;
  };
};

const meta = {
  component: ReviewHint,
  title: 'Sidebar/ReviewHint',
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/']}>
        <ManagerContext.Provider value={managerContext}>
          <ReviewProvider>
            <IconSymbols />
            <div
              style={{
                padding: 8,
                width: 280,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <Story />
            </div>
          </ReviewProvider>
        </ManagerContext.Provider>
      </MemoryRouter>
    ),
  ],
  beforeEach: async () => {
    await reviewService.commands.dismissReview(undefined);
    sessionStorage.clear();
    emit.mockClear();
    focusOnUIElement.mockClear();
    // The clipboard needs a permission in the test browser, and stories must not touch the real one.
    if (!navigator.clipboard) {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: async () => {} },
        configurable: true,
      });
    }
    spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    // The server has read the user settings and the hint is not dismissed.
    reviewHintStore.setState({ loaded: true });
    // The onboarding checklist has loaded and does not show its "Set up with AI" step.
    checklistStore.setState({ ...checklistInitialState, loaded: true });
    const restoreConfigType = withConfigType('DEVELOPMENT')();
    const unsetStatuses = setChangedStories();
    return () => {
      unsetStatuses();
      restoreConfigType();
    };
  },
} satisfies Meta<typeof ReviewHint>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Changed stories, no active review, not dismissed: the hint shows with the prompt to copy. */
export const Shown: Story = {
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('region', {
        name: 'Ask your agent for a UI review',
      })
    ).toBeVisible();
    // The prompt is part of the button's accessible name, so screen readers read it too.
    await expect(canvas.getByRole('button', { name: /Copy prompt/ })).toHaveAccessibleName(
      `Copy prompt ${UI_REVIEW_PROMPT}`
    );
  },
};

/** Copying writes the prompt to the clipboard, confirms it in the button, and records a nudge. */
export const Copied: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('button', { name: /Copy prompt/ }));
    await expect(mocked(navigator.clipboard.writeText)).toHaveBeenCalledWith(UI_REVIEW_PROMPT);
    await expect(await canvas.findByRole('button', { name: /Copied/ })).toBeVisible();
    await expect(emit).toHaveBeenCalledWith(AI_PROMPT_NUDGE, {
      id: 'ui-review',
      origin: 'sidebar-review-hint',
    });
  },
};

/** The copy button and the dismiss button are reachable with the keyboard, in that order. */
export const KeyboardCopy: Story = {
  play: async ({ canvas }) => {
    const copy = await canvas.findByRole('button', { name: /Copy prompt/ });
    await userEvent.tab();
    await expect(copy).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(mocked(navigator.clipboard.writeText)).toHaveBeenCalledWith(UI_REVIEW_PROMPT);
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'Dismiss review hint' })).toHaveFocus();
  },
};

/** Dismissing hides the hint, remembers it, and moves focus to the search field. */
export const Dismiss: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Dismiss review hint' }));
    await waitFor(() => expect(canvas.queryByRole('region')).toBeNull());
    await expect(reviewHintStore.getState().dismissedAt).toEqual(expect.any(Number));
    await expect(focusOnUIElement).toHaveBeenCalledWith('storybook-explorer-searchfield');
  },
};

/** Dismissed earlier, in this or another project: the hint stays hidden. */
export const Dismissed: Story = {
  beforeEach: () => {
    reviewHintStore.setState({ loaded: true, dismissedAt: Date.now() });
  },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('region')).toBeNull();
  },
};

/**
 * A review is active: the review widget takes over, so the hint hides. A user who has had a review
 * knows they can ask for one, so the hint does not come back after that review.
 */
export const ReviewActive: Story = {
  beforeEach: async () => {
    await reviewService.commands.setReview({
      title: 'Button style changes',
      description: '',
      createdAt: Date.now(),
      collections: [{ title: 'Collection', rationale: '', storyIds: ['s1', 's2'] }],
    });
  },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('region')).toBeNull();
    await waitFor(() => expect(reviewHintStore.getState().dismissedAt).toEqual(expect.any(Number)));
  },
};

/** Hidden until the server has read the user settings, since only they say whether it was dismissed. */
export const AppearsOnceSettingsLoad: Story = {
  beforeEach: () => {
    reviewHintStore.setState({});
  },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('region')).toBeNull();
    reviewHintStore.setState({ loaded: true });
    await expect(await canvas.findByRole('region')).toBeVisible();
  },
};

/**
 * On a first run the onboarding checklist shows its own "Set up with AI" step with a prompt to
 * copy. The hint waits until that step is done, so the sidebar does not show two prompt cards.
 */
export const AppearsOnceChecklistAiSetupIsDone: Story = {
  beforeEach: () => {
    checklistStore.setState({ ...checklistInitialState, loaded: true, aiOptIn: true });
  },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('region')).toBeNull();
    checklistStore.setState((state) => ({
      ...state,
      items: { ...state.items, aiSetup: { status: 'done' } },
    }));
    await expect(await canvas.findByRole('region')).toBeVisible();
  },
};

/** With the onboarding checklist turned off, its "Set up with AI" step does not hold the hint back. */
export const ChecklistTurnedOff: Story = {
  beforeEach: () => {
    checklistStore.setState({ ...checklistInitialState, loaded: true, aiOptIn: true });
    const features = global.FEATURES;
    global.FEATURES = { ...features, sidebarOnboardingChecklist: false };
    return () => {
      global.FEATURES = features;
    };
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('region')).toBeVisible();
  },
};

/** A static build cannot receive a review, so the hint never shows there. */
export const StaticBuild: Story = {
  beforeEach: withConfigType('PRODUCTION'),
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('region')).toBeNull();
  },
};

/** No new or modified stories: nothing to review. */
export const NoChanges: Story = {
  beforeEach: () => {
    internal_fullStatusStore.unset();
  },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('region')).toBeNull();
  },
};

/** The hint renders in the spot of the review widget, above the search and the changes filter. */
export const WithShowChangesButton: Story = {
  render: () => (
    <>
      <ReviewHint />
      <div style={{ height: 32, border: '1px dashed currentColor', opacity: 0.3 }}>search</div>
      <ShowChangesButton />
    </>
  ),
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('region')).toBeVisible();
    await expect(await canvas.findByRole('switch')).toHaveTextContent(
      'Show new and modified stories'
    );
  },
};

const InlineCopyButton = () => {
  const changedStoryCount = useChangedStoryCount();
  const { children, buttonProps } = useCopyButton<React.ReactNode>({
    content: UI_REVIEW_PROMPT,
    children: <WandIcon />,
    childrenOnCopy: <CheckIcon />,
    ariaLabel: 'Copy a prompt to ask your agent for a UI review',
    ariaLabelOnCopy: 'Prompt copied. Paste it in your agent.',
  });
  if (changedStoryCount === 0) {
    return null;
  }
  return (
    <Button variant="ghost" padding="small" size="small" {...buttonProps}>
      {children}
    </Button>
  );
};

/**
 * Alternative placement, not shipped, kept for the product decision: an icon button next to the
 * changes filter that copies the prompt, with its explanation only in the tooltip. It takes no
 * space, but users have to hover it to learn what it does, so it does a poor job of telling users
 * that they can ask for a review.
 */
export const AlternativeInlineButton: Story = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ flex: 1 }}>
        <ShowChangesButton />
      </div>
      <InlineCopyButton />
    </div>
  ),
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('button', { name: /Copy a prompt/ }));
    await expect(mocked(navigator.clipboard.writeText)).toHaveBeenCalledWith(UI_REVIEW_PROMPT);
  },
};
