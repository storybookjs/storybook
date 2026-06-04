import { expect, fn, within } from 'storybook/test';

import { ManagerContext, type API, type State } from 'storybook/manager-api';

import {
  buildReviewChangesDetailHref,
  buildReviewChangesSummaryHref,
} from '../review-navigation.ts';
import preview from '../../../../.storybook/preview.tsx';
import { DetailsScreen } from './DetailsScreen.tsx';

// DetailsScreen uses useAddonState (via the preview-mode toggle), which reads
// the manager API off ManagerContext. Provide a minimal in-memory mock so the
// stories render outside the real manager.
const addonStateStore: Record<string, unknown> = {};
const managerApi = {
  on: fn(() => () => {}),
  off: fn(),
  emit: fn(),
  getAddonState: fn((id: string) => addonStateStore[id]),
  setAddonState: fn((id: string, value: unknown) => {
    addonStateStore[id] = typeof value === 'function' ? value(addonStateStore[id]) : value;
    return Promise.resolve(addonStateStore[id]);
  }),
} as unknown as API;
const managerState = {} as State;

const meta = preview.meta({
  component: DetailsScreen,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <ManagerContext.Provider value={{ state: managerState, api: managerApi }}>
        <Story />
      </ManagerContext.Provider>
    ),
  ],
  beforeEach: () => {
    for (const key of Object.keys(addonStateStore)) {
      delete addonStateStore[key];
    }
  },
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
    // No baseline by default: only the latest preview, no comparison controls.
    await expect(await canvas.findByTitle('Latest components-toolbar--basic')).toBeInTheDocument();
    await expect(canvas.queryByTitle('Baseline components-toolbar--basic')).not.toBeInTheDocument();
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
      await canvas.findByTitle('Baseline components-toolbar--basic')
    ).toBeInTheDocument();
    await expect(await canvas.findByTitle('Latest components-toolbar--basic')).toBeInTheDocument();
    await expect(canvas.queryByText('New')).not.toBeInTheDocument();
    await expect(
      await canvas.findByRole('button', { name: 'Side-by-side view' })
    ).toBeInTheDocument();
  },
});

export const NewStory = meta.story({
  args: {
    hasBaseline: true,
    isNew: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('New')).toBeInTheDocument();
    await expect(await canvas.findByTitle('Latest components-toolbar--basic')).toBeInTheDocument();
    // A new story has no baseline to compare against: no baseline preview and no
    // side-by-side comparison controls.
    await expect(canvas.queryByTitle('Baseline components-toolbar--basic')).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole('button', { name: 'Side-by-side view' })
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
    storyId: 'components-toolbar--basic',
    storyIndex: 0,
    totalStories: 3,
    previousHref: buildReviewChangesDetailHref({
      collectionIndex: 0,
      storyId: 'components-toolbar--dense',
    }),
    nextHref: buildReviewChangesDetailHref({
      collectionIndex: 0,
      storyId: 'components-toolbar--compact',
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const previousButton = await canvas.findByRole('link', { name: 'Previous story' });
    const nextButton = await canvas.findByRole('link', { name: 'Next story' });
    await expect(previousButton.getAttribute('href')).toContain(
      '/review/0/components-toolbar--dense'
    );
    await expect(nextButton.getAttribute('href')).toContain(
      '/review/0/components-toolbar--compact'
    );
  },
});
