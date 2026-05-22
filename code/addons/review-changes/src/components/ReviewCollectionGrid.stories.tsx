import { expect, within } from 'storybook/test';

import preview from '../../../../.storybook/preview.tsx';
import { ReviewCollectionGrid } from './ReviewCollectionGrid.tsx';

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

const meta = preview.meta({
  component: ReviewCollectionGrid,
  parameters: { layout: 'fullscreen' },
  args: {
    storyIds: demoStoryIds,
  },
});

export const Default = meta.story({});

export const ManyStoriesAutoFit = meta.story({
  globals: { viewport: { value: 'mobile1' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('button', { name: /Review all/i })).toBeInTheDocument();

    const cells = Array.from(
      canvasElement.querySelectorAll('[data-testid="review-collection-grid-cell"]')
    ) as HTMLElement[];
    const rows = new Set(cells.map((cell) => Math.round(cell.getBoundingClientRect().top)));
    await expect(rows.size).toBeGreaterThan(1);
  },
});

export const FewStoriesStretch = meta.story({
  args: {
    storyIds: ['manager-main--default', 'manager-settings-aboutscreen--default'],
  },
  globals: { viewport: { value: 'desktop' } },
  play: async ({ canvasElement }) => {
    const cells = canvasElement.querySelectorAll('[data-testid="review-collection-grid-cell"]');
    await expect(cells.length).toBe(2);
  },
});

export const HeightIsCapped = meta.story({
  args: {
    storyIds: ['manager-main--default'],
  },
  globals: { viewport: { value: 'desktop' } },
  play: async ({ canvasElement }) => {
    const cell = canvasElement.querySelector('[data-testid="review-collection-grid-cell"]');
    await expect(cell).toBeTruthy();
    await expect((cell as HTMLElement).getBoundingClientRect().height).toBeLessThanOrEqual(400);
  },
});
