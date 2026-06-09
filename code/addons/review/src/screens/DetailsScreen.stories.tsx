import { expect, fn, userEvent, within } from 'storybook/test';

import { ManagerContext, type API, type State } from 'storybook/manager-api';

import { LayoutProvider } from '../../../../core/src/manager/components/layout/LayoutProvider.tsx';
import {
  buildReviewChangesDetailHref,
  buildReviewChangesSummaryHref,
} from '../review-navigation.ts';
import {
  PANEL_HEIGHT_SESSION_KEY,
  PANEL_VISIBLE_SESSION_KEY,
  PREVIEW_MODE_SESSION_KEY,
} from '../constants.ts';
import { sessionStore } from '../session-store.ts';
import preview from '../../../../.storybook/preview.tsx';
import { DetailsScreen } from './DetailsScreen.tsx';

const storyId = 'components-toolbar--basic';
const storyData = {
  type: 'story' as const,
  id: storyId,
  title: 'Manager/Components/Toolbar',
  name: 'Basic',
  parameters: {},
  args: {},
  initialArgs: {},
  argTypes: {},
};

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
  getData: fn((id: string) => (id === storyId ? storyData : undefined)).mockName('api::getData'),
  getCurrentStoryData: fn(() => storyData).mockName('api::getCurrentStoryData'),
  getElements: fn(() => ({})).mockName('api::getElements'),
  getShowToolbarWithCustomisations: fn((showToolbar: boolean) => showToolbar).mockName(
    'api::getShowToolbarWithCustomisations'
  ),
  getIsPanelShown: fn(() => true).mockName('api::getIsPanelShown'),
  togglePanel: fn().mockName('api::togglePanel'),
  setSelectedPanel: fn().mockName('api::setSelectedPanel'),
  getSelectedPanel: fn(() => 'controls').mockName('api::getSelectedPanel'),
  getShortcutKeys: fn(() => ({})).mockName('api::getShortcutKeys'),
  focusOnUIElement: fn(() => Promise.resolve(true)).mockName('api::focusOnUIElement'),
  getGlobals: fn(() => ({})).mockName('api::getGlobals'),
  getStoryGlobals: fn(() => ({})).mockName('api::getStoryGlobals'),
  getUserGlobals: fn(() => ({})).mockName('api::getUserGlobals'),
  updateGlobals: fn().mockName('api::updateGlobals'),
  updateStoryArgs: fn().mockName('api::updateStoryArgs'),
  resetStoryArgs: fn().mockName('api::resetStoryArgs'),
  getCurrentParameter: fn(() => ({})).mockName('api::getCurrentParameter'),
  setAddonShortcut: fn().mockName('api::setAddonShortcut'),
} as unknown as API;

const managerState = {
  storyId,
  viewMode: 'review',
  path: '/review/0/components-toolbar--basic',
  location: { search: '?path=/review/0/components-toolbar--basic' },
  previewInitialized: true,
  layout: {
    showToolbar: true,
    panelPosition: 'bottom',
  },
  shortcuts: {},
} as unknown as State;

const meta = preview.meta({
  component: DetailsScreen,
  parameters: {
    layout: 'fullscreen',
    chromatic: {
      ignoreSelectors: ['[data-testid="review-details-screen-preview"] iframe'],
    },
  },
  decorators: [
    (Story) => (
      <LayoutProvider forceDesktop>
        <ManagerContext.Provider value={{ state: managerState, api: managerApi }}>
          <Story />
        </ManagerContext.Provider>
      </LayoutProvider>
    ),
  ],
  beforeEach: () => {
    for (const key of Object.keys(addonStateStore)) {
      delete addonStateStore[key];
    }
    sessionStore.remove(PREVIEW_MODE_SESSION_KEY);
    sessionStore.remove(PANEL_VISIBLE_SESSION_KEY);
    sessionStore.remove(PANEL_HEIGHT_SESSION_KEY);
  },
  args: {
    title: 'Toolbar & direct consumers',
    componentTitle: 'Manager/Components/Toolbar',
    storyName: 'Basic',
    storyId,
    storyIndex: 1,
    totalStories: 3,
    previewHref: 'iframe.html?id=components-toolbar--basic&viewMode=story',
    storybookHref: '?path=/story/components-toolbar--basic',
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
    await expect(await canvas.findByTestId('sb-preview-toolbar')).toBeInTheDocument();
    await expect(await canvas.findByRole('region', { name: 'Addon panel' })).toBeInTheDocument();
    await expect(await canvas.findByTitle('Latest components-toolbar--basic')).toBeInTheDocument();
    await expect(canvas.queryByTitle('Baseline components-toolbar--basic')).not.toBeInTheDocument();
    const latestFrame = await canvas.findByTitle('Latest components-toolbar--basic');
    await expect(latestFrame).toHaveAttribute('id', 'storybook-preview-iframe');
  },
});

export const WithBaseline = meta.story({
  args: {
    hasBaseline: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Latest')).toBeInTheDocument();
    await expect(canvas.queryByText('Baseline')).not.toBeInTheDocument();
    await expect(
      await canvas.findByRole('button', { name: 'Switch baseline and latest' })
    ).toBeInTheDocument();
    await expect(
      await canvas.findByTitle('Baseline components-toolbar--basic')
    ).toBeInTheDocument();
    await expect(await canvas.findByTitle('Latest components-toolbar--basic')).toBeInTheDocument();
    await expect(canvas.queryByText('New')).not.toBeInTheDocument();
    await expect(
      await canvas.findByRole('button', { name: 'Side-by-side view' })
    ).toBeInTheDocument();
    await expect(await canvas.findByTestId('sb-preview-toolbar')).toBeInTheDocument();
  },
});

export const WithBaselineSplit = meta.story({
  args: {
    hasBaseline: true,
  },
  beforeEach: () => {
    sessionStore.write(PREVIEW_MODE_SESSION_KEY, '2up');
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Baseline')).toBeInTheDocument();
    await expect(await canvas.findByText('Latest')).toBeInTheDocument();
    await expect(
      await canvas.findByTitle('Baseline components-toolbar--basic')
    ).toBeInTheDocument();
    await expect(await canvas.findByTitle('Latest components-toolbar--basic')).toBeInTheDocument();
    await expect(
      canvas.queryByRole('button', { name: 'Switch baseline and latest' })
    ).not.toBeInTheDocument();
    await expect(await canvas.findByRole('region', { name: 'Addon panel' })).toBeInTheDocument();
  },
});

export const NewStory = meta.story({
  args: {
    hasBaseline: true,
    isNewlyAdded: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('New')).toBeInTheDocument();
    await expect(await canvas.findByTitle('Latest components-toolbar--basic')).toBeInTheDocument();
    await expect(canvas.queryByTitle('Baseline components-toolbar--basic')).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole('button', { name: 'Side-by-side view' })
    ).not.toBeInTheDocument();
    await expect(await canvas.findByTestId('sb-preview-toolbar')).toBeInTheDocument();
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
    storyId,
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

export const PanelToggle = meta.story({
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('region', { name: 'Addon panel' })).toBeInTheDocument();
    await userEvent.click(await canvas.findByRole('button', { name: 'Hide addon panel' }));
    await expect(canvas.queryByRole('region', { name: 'Addon panel' })).not.toBeInTheDocument();
    await expect(
      await canvas.findByRole('button', { name: 'Show addon panel' })
    ).toBeInTheDocument();
    await userEvent.click(await canvas.findByRole('button', { name: 'Show addon panel' }));
    await expect(await canvas.findByRole('region', { name: 'Addon panel' })).toBeInTheDocument();
  },
});

export const PanelPersistence = meta.story({
  beforeEach: () => {
    sessionStore.write(PANEL_VISIBLE_SESSION_KEY, 'false');
    sessionStore.write(PANEL_HEIGHT_SESSION_KEY, '420');
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('region', { name: 'Addon panel' })).not.toBeInTheDocument();
    await expect(
      await canvas.findByRole('button', { name: 'Show addon panel' })
    ).toBeInTheDocument();
    await userEvent.click(await canvas.findByRole('button', { name: 'Show addon panel' }));
    await expect(await canvas.findByRole('region', { name: 'Addon panel' })).toBeInTheDocument();
    await expect(sessionStore.read(PANEL_VISIBLE_SESSION_KEY)).toBe('true');
    await expect(sessionStore.read(PANEL_HEIGHT_SESSION_KEY)).toBe('420');
  },
});
