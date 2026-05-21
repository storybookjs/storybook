import { expect, userEvent, within } from 'storybook/test';

import preview from '../../../../.storybook/preview.tsx';
import type { ReviewState } from '../review-state.ts';
import { ReviewChangesScreen } from './ReviewChangesScreen.tsx';

const minimal: ReviewState = {
  title: 'Button prop rename',
  branchName: 'update/button-styles',
  narrative:
    'Renamed the Button `appearance` prop to `variant` and updated all internal usages. No visual change is expected.',
  clusters: [
    {
      label: 'Button',
      rationale: 'The directly changed component.',
      sampleStoryIds: ['button-component--variants', 'button-component--base'],
    },
  ],
};

const full: ReviewState = {
  title: 'Primary button visual refresh',
  branchName: 'update/button-weight-and-padding',
  narrative:
    'Made the primary/solid Button bolder: font-weight 700 → 800 and larger padding. Outline and ghost variants are unchanged. Start with Variants and Sizes/Paddings, then sanity-check ToggleButton and ReviewChangesButton.',
  changedFiles: ['code/core/src/components/components/Button/Button.tsx'],
  clusters: [
    {
      label: 'Core Button — primary/solid variant',
      rationale: 'Render the solid variant directly; best show the heavier weight and padding.',
      kind: 'atomic',
      sampleStoryIds: [
        'button-component--variants',
        'button-component--base',
        'button-component--sizes',
      ],
    },
    {
      label: 'Related Button-based components',
      rationale: 'ToggleButton and ReviewChangesButton build on the same Button primitive.',
      kind: 'transitive',
      sampleStoryIds: ['components-togglebutton--variants', 'components-togglebutton--sizes'],
    },
  ],
  diffHunks: [
    {
      path: 'code/core/src/components/components/Button/Button.tsx',
      hunk: [
        '@@ -120,7 +120,7 @@',
        '-  fontWeight: theme.typography.weight.bold,',
        '+  fontWeight: variant === "solid" ? 800 : theme.typography.weight.bold,',
        '-  padding: size === "small" ? "0 10px" : "0 12px",',
        '+  padding: size === "small" ? "0 14px" : "0 16px",',
      ].join('\n'),
    },
  ],
  storyMeta: {
    'button-component--variants': { depth: 0, chain: [] },
    'components-togglebutton--variants': {
      depth: 2,
      chain: ['code/core/src/components/components/ToggleButton/ToggleButton.tsx'],
    },
  },
};

const largeCascade: ReviewState = {
  title: 'Theme token cascade review',
  branchName: 'refactor/theme-tokens',
  narrative:
    'Refactored the shared theme tokens. Change-detection flagged a broad cascade; most consumers are transitive and unlikely to shift visibly. Spot-check the atomic and consumer tiers first.',
  changedFiles: ['code/core/src/theming/tokens.ts', 'code/core/src/theming/create.ts'],
  clusters: [
    ...full.clusters,
    {
      label: 'Storybook manager surfaces',
      rationale:
        'Manager views consume shared typography, spacing, and theming tokens that can shift subtly.',
      kind: 'consumer',
      sampleStoryIds: [
        'manager-main--default',
        'manager-main--about-page',
        'manager-main--guide-page',
        'manager-sidebar-sidebar--simple',
      ],
    },
    {
      label: 'Sidebar density and search experience',
      rationale:
        'Sidebar layouts are sensitive to token updates in spacing and color contrast, especially in filtered states.',
      kind: 'consumer',
      sampleStoryIds: [
        'manager-sidebar-sidebar--searching',
        'manager-sidebar-sidebar--statuses-open',
        'manager-sidebar-sidebar--with-refs',
        'manager-sidebar-sidebar--with-cta-active',
      ],
    },
    {
      label: 'Settings and onboarding pages',
      rationale:
        'Settings pages use shared UI primitives and should be spot-checked for readability and alignment.',
      kind: 'transitive',
      sampleStoryIds: [
        'manager-settings-aboutscreen--default',
        'manager-settings-guidepage--default',
        'manager-settings-shortcutsscreen--defaults',
        'manager-settings-checklist--default',
      ],
    },
    {
      label: 'Core UI primitives',
      rationale:
        'Primitive components amplify token regressions across addons and manager surfaces.',
      kind: 'atomic',
      sampleStoryIds: [
        'components-tabs-tabsview--basic',
        'components-card--default',
        'components-collapsible--default',
        'components-bar-bar--default',
      ],
    },
    {
      label: 'Performance and analyzer tools',
      rationale:
        'Bench and diagnostics views exercise dense layouts where token changes are easy to miss.',
      kind: 'catch-all',
      sampleStoryIds: [
        'bench--es-build-analyzer',
        'manager-sidebar-filesearchmodal--default',
        'manager-sidebar-filesearchlist--default',
        'manager-components-preview-viewport--default',
      ],
    },
  ],
  diffHunks: [
    {
      path: 'code/core/src/theming/tokens.ts',
      hunk: Array.from({ length: 40 })
        .map((_, i) => (i % 3 === 0 ? `-  token${i}: '#aaa',` : `+  token${i}: '#bbb',`))
        .join('\n'),
    },
  ],
};

const pagesAndBench: ReviewState = {
  title: 'Page components and bench analyzer',
  branchName: 'chore/review-pages-and-bench',
  narrative:
    'Validating the review grid with manager page stories alongside the bench analyzer story.',
  clusters: [
    {
      label: 'Manager pages + Bench',
      rationale: 'Mixes page-level stories with the ESBuild analyzer story for preview coverage.',
      sampleStoryIds: [
        'manager-settings-aboutscreen--default',
        'manager-settings-guidepage--default',
        'manager-main--about-page',
        'bench--es-build-analyzer',
      ],
    },
  ],
};

const meta = preview.meta({
  component: ReviewChangesScreen,
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
    await expect(
      await canvas.findByText(/Showing unstaged changes on update\/button-styles/i)
    ).toBeInTheDocument();
    await expect(await canvas.findByRole('button', { name: 'Collections' })).toBeInTheDocument();
  },
});

export const Full = meta.story({
  args: { state: full },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Primary button visual refresh')).toBeInTheDocument();
    await expect(await canvas.findByRole('button', { name: 'Storybook' })).toBeInTheDocument();
    await userEvent.click(await canvas.findByRole('button', { name: 'Components' }));
    await expect(await canvas.findByText('Components view coming soon.')).toBeInTheDocument();
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
