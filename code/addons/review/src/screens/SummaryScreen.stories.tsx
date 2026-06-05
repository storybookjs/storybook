import { expect, within } from 'storybook/test';

import preview from '../../../../.storybook/preview.tsx';
import type { ReviewState } from '../review-state.ts';
import { SummaryScreen } from './SummaryScreen.tsx';

const minimal: ReviewState = {
  title: 'Button prop rename',
  branchName: 'update/button-styles',
  description:
    'Renamed the Button `appearance` prop to `variant` and updated all internal usages. No visual change is expected.',
  createdAt: Date.now() - 2 * 60 * 1000,
  collections: [
    {
      title: 'Button',
      rationale: 'The directly changed component.',
      storyIds: ['button-component--variants', 'button-component--base'],
    },
  ],
};

const full: ReviewState = {
  title: 'Primary button visual refresh',
  branchName: 'update/button-weight-and-padding',
  createdAt: Date.now() - 14 * 60 * 1000,
  description:
    'Made the primary/solid Button bolder: font-weight 700 → 800 and larger padding. Outline and ghost variants are unchanged. Start with Variants and Sizes/Paddings, then sanity-check ToggleButton and ReviewChangesButton.',
  changedFiles: ['code/core/src/components/components/Button/Button.tsx'],
  collections: [
    {
      title: 'Core Button — primary/solid variant',
      rationale: 'Render the solid variant directly; best show the heavier weight and padding.',
      kind: 'atomic',
      storyIds: ['button-component--variants', 'button-component--base', 'button-component--sizes'],
    },
    {
      title: 'Related Button-based components',
      rationale: 'ToggleButton and ReviewChangesButton build on the same Button primitive.',
      kind: 'transitive',
      storyIds: ['components-togglebutton--variants', 'components-togglebutton--sizes'],
    },
  ],
};

const largeCascade: ReviewState = {
  title: 'Theme token cascade review',
  branchName: 'refactor/theme-tokens',
  description:
    'Refactored the shared theme tokens. Change-detection flagged a broad cascade; most consumers are transitive and unlikely to shift visibly. Spot-check the atomic and consumer tiers first.',
  changedFiles: ['code/core/src/theming/tokens.ts', 'code/core/src/theming/create.ts'],
  collections: [
    ...full.collections,
    {
      title: 'Storybook manager surfaces',
      rationale:
        'Manager views consume shared typography, spacing, and theming tokens that can shift subtly.',
      kind: 'consumer',
      storyIds: [
        'manager-main--default',
        'manager-main--about-page',
        'manager-main--guide-page',
        'manager-sidebar-sidebar--simple',
        'manager-sidebar-sidebar--with-refs',
        'manager-sidebar-sidebar--statuses-open',
      ],
    },
    {
      title: 'Sidebar density and search experience',
      rationale:
        'Sidebar layouts are sensitive to token updates in spacing and color contrast, especially in filtered states.',
      kind: 'consumer',
      storyIds: [
        'manager-sidebar-sidebar--searching',
        'manager-sidebar-sidebar--statuses-open',
        'manager-sidebar-sidebar--with-refs',
        'manager-sidebar-sidebar--with-cta-active',
      ],
    },
    {
      title: 'Settings and onboarding pages',
      rationale:
        'Settings pages use shared UI primitives and should be spot-checked for readability and alignment.',
      kind: 'transitive',
      storyIds: [
        'manager-settings-aboutscreen--default',
        'manager-settings-guidepage--default',
        'manager-settings-shortcutsscreen--defaults',
        'manager-settings-checklist--default',
      ],
    },
    {
      title: 'Core UI primitives',
      rationale:
        'Primitive components amplify token regressions across addons and manager surfaces.',
      kind: 'atomic',
      storyIds: [
        'components-tabs-tabsview--basic',
        'components-card--default',
        'components-collapsible--default',
        'components-bar-bar--default',
      ],
    },
    {
      title: 'Performance and analyzer tools',
      rationale:
        'Bench and diagnostics views exercise dense layouts where token changes are easy to miss.',
      kind: 'catch-all',
      storyIds: [
        'bench--es-build-analyzer',
        'manager-sidebar-filesearchmodal--default',
        'manager-sidebar-filesearchlist--default',
        'manager-components-preview-viewport--default',
      ],
    },
  ],
};

const pagesAndBench: ReviewState = {
  title: 'Page components and bench analyzer',
  branchName: 'chore/review-pages-and-bench',
  description:
    'Validating the review grid with manager page stories alongside the bench analyzer story.',
  collections: [
    {
      title: 'Manager pages + Bench',
      rationale: 'Mixes page-level stories with the ESBuild analyzer story for preview coverage.',
      storyIds: [
        'manager-settings-aboutscreen--default',
        'manager-settings-guidepage--default',
        'manager-main--about-page',
        'bench--es-build-analyzer',
      ],
    },
  ],
};

const atomicChange: ReviewState = {
  title: 'Round up Button border-radius: 4px → 12px (3× theme multiplier)',
  description:
    'Changed `borderRadius: theme.input.borderRadius` to `theme.input.borderRadius * 3` in Button.tsx, making all buttons noticeably more pill-shaped; start reviewing Button/Variants and Toolbar/Basic to see the ripple.',
  collections: [
    {
      title: 'Button — atomic',
      rationale:
        'Directly changed component; all variants and sizes now use 12px border-radius instead of 4px.',
      storyIds: [
        'button-component--variants',
        'button-component--sizes',
        'button-component--paddings',
        'button-component--pseudo-states',
        'button-component--icon-only',
        'button-component--base',
      ],
      kind: 'atomic',
    },
    {
      title: 'Toolbar, Tabs & Select — direct consumers',
      rationale:
        'These components embed Button directly and their toolbar/tab buttons will visually reflect the rounder corners.',
      storyIds: [
        'components-toolbar--basic',
        'components-toolbar--scrollable',
        'components-abstracttoolbar--basic',
        'components-tabs--stateful-static',
        'components-tabs--stateless-with-tools',
        'select-component--base',
      ],
      kind: 'consumer',
    },
    {
      title: 'Modal & Popover — overlays with buttons',
      rationale:
        'Modal and Popover action bars contain buttons whose rounded corners are now more prominent.',
      storyIds: [
        'overlay-modal--base',
        'overlay-modal--interactive-mouse',
        'overlay-popover--with-hide-button',
        'overlay-popover--with-chrome',
      ],
      kind: 'consumer',
    },
    {
      title: 'Docs blocks & Manager menu — transitive',
      rationale:
        'Preview action bars and manager menus further down the dependency graph pick up the change through toolbar/button usage.',
      storyIds: [
        'addons-docs-blocks-components-preview--with-toolbar',
        'addons-docs-blocks-components-preview--code-expanded',
        'manager-container-menu--with-shortcuts',
        'manager-container-menu--with-shortcuts-active',
      ],
      kind: 'transitive',
    },
  ],
  changedFiles: ['core/src/components/components/Button/Button.tsx'],
};

const manyCollections: ReviewState = {
  title: 'Large review surface: many collections and stories',
  branchName: 'perf/review-large-dataset',
  description:
    'Stress-test the Summary screen with many collections and many story previews using real stories from the internal Storybook.',
  collections: [
    {
      title: 'Collection 01 — Button core',
      rationale: 'Base button stories and primary variants.',
      kind: 'atomic',
      storyIds: ['button-component--base', 'button-component--variants', 'button-component--sizes'],
    },
    {
      title: 'Collection 02 — Button details',
      rationale: 'Additional button states and icon usage.',
      kind: 'atomic',
      storyIds: [
        'button-component--paddings',
        'button-component--pseudo-states',
        'button-component--icon-only',
      ],
    },
    {
      title: 'Collection 03 — Toggle and tabs',
      rationale: 'ToggleButton and tab view combinations.',
      kind: 'consumer',
      storyIds: [
        'components-togglebutton--variants',
        'components-togglebutton--sizes',
        'components-tabs-tabsview--basic',
      ],
    },
    {
      title: 'Collection 04 — Tabs and toolbar',
      rationale: 'Navigation/tab states with toolbar layouts.',
      kind: 'consumer',
      storyIds: [
        'components-tabs--stateful-static',
        'components-tabs--stateless-with-tools',
        'components-toolbar--basic',
      ],
    },
    {
      title: 'Collection 05 — Toolbar variants',
      rationale: 'Scrollable toolbar and abstract toolbar coverage.',
      kind: 'consumer',
      storyIds: [
        'components-toolbar--scrollable',
        'components-abstracttoolbar--basic',
        'select-component--base',
      ],
    },
    {
      title: 'Collection 06 — Surface primitives',
      rationale: 'Cards, bars, and collapsible primitives.',
      kind: 'consumer',
      storyIds: [
        'components-card--default',
        'components-bar-bar--default',
        'components-collapsible--default',
      ],
    },
    {
      title: 'Collection 07 — Overlay modal',
      rationale: 'Modal base and interactive states.',
      kind: 'consumer',
      storyIds: [
        'overlay-modal--base',
        'overlay-modal--interactive-mouse',
        'overlay-popover--with-hide-button',
      ],
    },
    {
      title: 'Collection 08 — Overlay popover',
      rationale: 'Popover/chrome combinations and behavior.',
      kind: 'consumer',
      storyIds: [
        'overlay-popover--with-chrome',
        'overlay-popover--with-hide-button',
        'overlay-modal--base',
      ],
    },
    {
      title: 'Collection 09 — Manager main',
      rationale: 'Main manager page states.',
      kind: 'consumer',
      storyIds: ['manager-main--default', 'manager-main--about-page', 'manager-main--guide-page'],
    },
    {
      title: 'Collection 10 — Manager settings',
      rationale: 'Settings pages and checklist entry points.',
      kind: 'consumer',
      storyIds: [
        'manager-settings-aboutscreen--default',
        'manager-settings-guidepage--default',
        'manager-settings-shortcutsscreen--defaults',
      ],
    },
    {
      title: 'Collection 11 — Guide variants',
      rationale: 'Guide page variations for state coverage.',
      kind: 'consumer',
      storyIds: [
        'manager-settings-guidepage--all-done',
        'manager-settings-guidepage--ai-cta-open',
        'manager-settings-guidepage--ai-cta-skipped',
      ],
    },
    {
      title: 'Collection 12 — Guide + freeze stories',
      rationale: 'Guide and freeze test stories.',
      kind: 'consumer',
      storyIds: [
        'manager-settings-guidepage--ai-cta-done',
        'manager-settings-freezebehavior--play-clicks-button',
        'manager-settings-freezebehavior--delayed-play-completion',
      ],
    },
    {
      title: 'Collection 13 — Freeze loop and sidebar',
      rationale: 'Freeze animation loop and basic sidebar states.',
      kind: 'consumer',
      storyIds: [
        'manager-settings-freezebehavior--continuous-loop-and-animation',
        'manager-sidebar-sidebar--simple',
        'manager-sidebar-sidebar--with-refs',
      ],
    },
    {
      title: 'Collection 14 — Sidebar status/search',
      rationale: 'Search and status-focused sidebar views.',
      kind: 'consumer',
      storyIds: [
        'manager-sidebar-sidebar--statuses-open',
        'manager-sidebar-sidebar--searching',
        'manager-sidebar-sidebar--with-cta-active',
      ],
    },
    {
      title: 'Collection 15 — Sidebar file search',
      rationale: 'Sidebar file-search specific components.',
      kind: 'consumer',
      storyIds: [
        'manager-sidebar-filesearchmodal--default',
        'manager-sidebar-filesearchlist--default',
        'manager-container-menu--with-shortcuts',
      ],
    },
    {
      title: 'Collection 16 — Menu and viewport',
      rationale: 'Menu variants and preview viewport panel.',
      kind: 'transitive',
      storyIds: [
        'manager-container-menu--with-shortcuts-active',
        'manager-components-preview-viewport--default',
        'manager-sidebar-sidebar--simple',
      ],
    },
    {
      title: 'Collection 17 — Docs preview blocks',
      rationale: 'Docs block preview stories with toolbar/code.',
      kind: 'transitive',
      storyIds: [
        'addons-docs-blocks-components-preview--with-toolbar',
        'addons-docs-blocks-components-preview--code-expanded',
        'manager-components-preview-viewport--default',
      ],
    },
    {
      title: 'Collection 18 — Bench + docs mix',
      rationale: 'Heavier analyzer story plus docs previews.',
      kind: 'catch-all',
      storyIds: [
        'bench--es-build-analyzer',
        'addons-docs-blocks-components-preview--with-toolbar',
        'addons-docs-blocks-components-preview--code-expanded',
      ],
    },
    {
      title: 'Collection 19 — Cross-manager mix',
      rationale: 'Mixed manager states to create dense list.',
      kind: 'catch-all',
      storyIds: [
        'manager-main--default',
        'manager-settings-checklist--default',
        'manager-sidebar-sidebar--statuses-open',
      ],
    },
    {
      title: 'Collection 20 — Large mixed tail',
      rationale: 'Final mixed collection to reach 20 groups.',
      kind: 'catch-all',
      storyIds: [
        'components-tabs-tabsview--basic',
        'manager-container-menu--with-shortcuts',
        'manager-settings-guidepage--default',
        'bench--es-build-analyzer',
      ],
    },
  ],
};

const fortyStoryCollection: ReviewState = {
  title: 'Large collection overflow',
  branchName: 'perf/large-collection',
  description: 'A single collection with 40 stories to exercise the two-row cap and "Review all" overflow affordance.',
  collections: [
    {
      title: 'All changed stories',
      rationale: 'Every story affected by this change.',
      storyIds: [
        'button-component--base',
        'button-component--variants',
        'button-component--sizes',
        'button-component--paddings',
        'button-component--pseudo-states',
        'button-component--icon-only',
        'components-togglebutton--variants',
        'components-togglebutton--sizes',
        'components-tabs-tabsview--basic',
        'components-tabs--stateful-static',
        'components-tabs--stateless-with-tools',
        'components-toolbar--basic',
        'components-toolbar--scrollable',
        'components-abstracttoolbar--basic',
        'select-component--base',
        'components-card--default',
        'components-bar-bar--default',
        'components-collapsible--default',
        'overlay-modal--base',
        'overlay-modal--interactive-mouse',
        'overlay-popover--with-hide-button',
        'overlay-popover--with-chrome',
        'manager-main--default',
        'manager-main--about-page',
        'manager-main--guide-page',
        'manager-settings-aboutscreen--default',
        'manager-settings-guidepage--default',
        'manager-settings-shortcutsscreen--defaults',
        'manager-settings-checklist--default',
        'manager-sidebar-sidebar--simple',
        'manager-sidebar-sidebar--with-refs',
        'manager-sidebar-sidebar--statuses-open',
        'manager-sidebar-sidebar--searching',
        'manager-sidebar-sidebar--with-cta-active',
        'manager-sidebar-filesearchmodal--default',
        'manager-sidebar-filesearchlist--default',
        'manager-container-menu--with-shortcuts',
        'manager-container-menu--with-shortcuts-active',
        'manager-components-preview-viewport--default',
        'bench--es-build-analyzer',
      ],
    },
  ],
};

const meta = preview.meta({
  component: SummaryScreen,
  parameters: { layout: 'fullscreen' },
  args: {},
});

export const Empty = meta.story({
  args: { state: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(/Waiting for the agent/i)).toBeInTheDocument();
  },
});

export const Minimal = meta.story({
  args: { state: minimal },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Button prop rename')).toBeInTheDocument();
    await expect(await canvas.findByText(/2 stories for quick review/i)).toBeInTheDocument();
    await expect(await canvas.findByText('Button')).toBeInTheDocument();
  },
});

export const Full = meta.story({
  args: {
    state: full,
    storyInfo: {
      // Collection 1 — first story is new
      'button-component--variants': { title: 'Button', name: 'Variants', isNew: true },
      'button-component--base': { title: 'Button', name: 'Base' },
      'button-component--sizes': { title: 'Button', name: 'Sizes' },
      // Collection 2 — first story is new
      'components-togglebutton--variants': {
        title: 'ToggleButton',
        name: 'Variants',
        isNew: true,
      },
      'components-togglebutton--sizes': { title: 'ToggleButton', name: 'Sizes' },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Primary button visual refresh')).toBeInTheDocument();
    await expect(await canvas.findByRole('link', { name: 'View Storybook' })).toBeInTheDocument();
  },
});

export const LargeCascade = meta.story({
  args: { state: largeCascade },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Theme token cascade review')).toBeInTheDocument();
    await expect(await canvas.findByText('Storybook manager surfaces')).toBeInTheDocument();
  },
});

export const PagesAndBench = meta.story({
  args: { state: pagesAndBench },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Page components and bench analyzer')).toBeInTheDocument();
    await expect(await canvas.findByText('Manager pages + Bench')).toBeInTheDocument();
  },
});

export const RealAtomicChange = meta.story({
  args: { state: atomicChange },
});

export const Stale = meta.story({
  args: { state: full, isStale: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText('This review may be stale. Ask your agent to refresh it.')
    ).toBeInTheDocument();
    await expect(await canvas.findByText('Primary button visual refresh')).toBeInTheDocument();
  },
});

// A single collection with 40 stories: the grid caps at 2 rows and shows a
// "Review all 40" button in the last slot until the user expands it.
export const LargeCollectionOverflow = meta.story({
  args: { state: fortyStoryCollection },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Large collection overflow')).toBeInTheDocument();
    await expect(await canvas.findByRole('button', { name: /Review all 40/i })).toBeInTheDocument();
  },
});

export const ManyCollections = meta.story({
  args: { state: manyCollections },
  parameters: { chromatic: { disableSnapshot: true } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText('Large review surface: many collections and stories')
    ).toBeInTheDocument();
    await expect(await canvas.findByText('Collection 01 — Button core')).toBeInTheDocument();
    await expect(await canvas.findByText('Collection 20 — Large mixed tail')).toBeInTheDocument();
  },
});
