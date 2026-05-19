import { expect, fn, userEvent, within } from 'storybook/test';

import preview from '../../../../.storybook/preview.tsx';
import type { ReviewState } from '../review-state.ts';
import { ReviewChangesView } from './ReviewChangesPage.tsx';

const minimal: ReviewState = {
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
  narrative:
    'Refactored the shared theme tokens. Change-detection flagged a broad cascade; most consumers are transitive and unlikely to shift visibly. Spot-check the atomic and consumer tiers first.',
  changedFiles: ['code/core/src/theming/tokens.ts', 'code/core/src/theming/create.ts'],
  clusters: Array.from({ length: 8 }).map((_, c) => ({
    label: `Cluster ${c + 1}`,
    rationale: `Group ${c + 1}: stories transitively importing the changed theme tokens through varying depths.`,
    kind: (['atomic', 'consumer', 'transitive', 'catch-all'] as const)[c % 4],
    sampleStoryIds: Array.from({ length: 6 }).map((__, s) => `cluster-${c + 1}--story-${s + 1}`),
  })),
  diffHunks: [
    {
      path: 'code/core/src/theming/tokens.ts',
      hunk: Array.from({ length: 40 })
        .map((_, i) => (i % 3 === 0 ? `-  token${i}: '#aaa',` : `+  token${i}: '#bbb',`))
        .join('\n'),
    },
  ],
};

const meta = preview.meta({
  title: 'ReviewChangesView',
  component: ReviewChangesView,
  parameters: { layout: 'fullscreen' },
  args: { onClose: fn() },
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
    await expect(await canvas.findByText(/Renamed the Button/i)).toBeInTheDocument();
    await expect(await canvas.findByText('Clusters (1)')).toBeInTheDocument();
  },
});

export const Full = meta.story({
  args: { state: full },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText(/Made the primary\/solid Button bolder/)
    ).toBeInTheDocument();
    await expect(await canvas.findByText('Changed files')).toBeInTheDocument();
    await expect(await canvas.findByText('Clusters (2)')).toBeInTheDocument();
    await expect(await canvas.findByText('Diff hunks')).toBeInTheDocument();
    await userEvent.click(await canvas.findByRole('button', { name: 'Close' }));
    await expect(args.onClose).toHaveBeenCalled();
  },
});

export const LargeCascade = meta.story({
  args: { state: largeCascade },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Clusters (8)')).toBeInTheDocument();
  },
});
