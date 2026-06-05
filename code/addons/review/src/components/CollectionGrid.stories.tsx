import { expect, within } from 'storybook/test';

import preview from '../../../../.storybook/preview.tsx';
import { CollectionGrid, type StoryInfo } from './CollectionGrid.tsx';

const demoStoryIds = [
  'button-component--base',
  'button-component--variants',
  'button-component--sizes',
  'manager-main--default',
  'manager-sidebar-sidebar--simple',
  'manager-settings-aboutscreen--default',
  'components-tabs-tabsview--basic',
  'bench--es-build-analyzer',
];

const titleCase = (value: string) =>
  value
    .split(/[-/]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

// Stand-in for the Storybook index: every demo story resolves to a title +
// name so the grid renders it (stories with no index entry are skipped).
const demoStoryInfo: Record<string, StoryInfo> = Object.fromEntries(
  demoStoryIds.map((id) => {
    const [componentId, ...rest] = id.split('--');
    return [id, { title: titleCase(componentId), name: titleCase(rest.join('--')) || 'Story' }];
  })
);

const meta = preview.meta({
  component: CollectionGrid,
  parameters: { layout: 'fullscreen' },
  args: {
    storyIds: demoStoryIds,
    storyInfo: demoStoryInfo,
    getStoryPreviewHref: (storyId: string) =>
      `iframe.html?id=${encodeURIComponent(storyId)}&viewMode=story&freeze=finished`,
  },
});

export const Default = meta.story({});

// On a narrow (mobile) container the grid drops to a single column and caps at
// two rows, so eight stories overflow into the "Review all" affordance.
export const ManyStoriesOverflow = meta.story({
  globals: { viewport: { value: 'mobile1' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('button', { name: /Review all/i })).toBeInTheDocument();
  },
});

export const FewStories = meta.story({
  args: {
    storyIds: ['manager-main--default', 'manager-settings-aboutscreen--default'],
  },
  globals: { viewport: { value: 'desktop' } },
  play: async ({ canvasElement }) => {
    const cells = canvasElement.querySelectorAll('[data-testid="review-collection-grid-cell"]');
    await expect(cells.length).toBe(2);
    await expect(
      canvasElement.querySelector<HTMLButtonElement>('[data-review-all] button')
    ).not.toBeVisible();
  },
});

// A single preview clamps to 400px instead of stretching to fill the card, so
// the grid layout stays consistent regardless of story count.
export const SingleCellClamped = meta.story({
  args: {
    storyIds: ['manager-main--default'],
  },
  globals: { viewport: { value: 'desktop' } },
  play: async ({ canvasElement }) => {
    const cell = canvasElement.querySelector('[data-testid="review-collection-grid-cell"]');
    await expect(cell).toBeTruthy();
    await expect((cell as HTMLElement).getBoundingClientRect().width).toBeLessThanOrEqual(401);
  },
});
