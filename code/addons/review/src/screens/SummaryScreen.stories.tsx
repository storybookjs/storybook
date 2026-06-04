import { expect, within } from 'storybook/test';

import preview from '../../../../.storybook/preview.tsx';
import type { ReviewState } from '../review-state.ts';
import { SummaryScreen } from './SummaryScreen.tsx';

const minimal: ReviewState = {
  title: 'Button prop rename',
  branchName: 'update/button-styles',
  description:
    'Renamed the Button `appearance` prop to `variant` and updated all internal usages. No visual change is expected.',
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
    await expect(await canvas.findByText(/Showing 2 agent-curated stories/i)).toBeInTheDocument();
    await expect(await canvas.findByText('Button')).toBeInTheDocument();
  },
});

export const Full = meta.story({
  args: { state: full },
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
