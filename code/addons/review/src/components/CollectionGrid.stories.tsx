import { expect, within } from 'storybook/test';

import preview from '../../../../.storybook/preview.tsx';
import { CollectionGrid } from './CollectionGrid.tsx';

// 40 unique story IDs drawn from real internal stories.
const fortyStoryIds = [
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
];

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
  component: CollectionGrid,
  parameters: { layout: 'fullscreen' },
  args: {
    storyIds: demoStoryIds,
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
// 40 stories: the grid caps at 2 rows (7 cells + "Review all 40" in the last
// slot). Clicking the button drops the cap and loads all 40 with lazy eviction.
export const FortyStoriesOverflow = meta.story({
  args: { storyIds: fortyStoryIds },
  globals: { viewport: { value: 'desktop' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const reviewAllButton = await canvas.findByRole('button', { name: /Review all 40/i });
    await expect(reviewAllButton).toBeInTheDocument();
    // Only 7 story cells visible before expanding (8th slot is taken by the button).
    const cells = canvasElement.querySelectorAll('[data-testid="review-collection-grid-cell"]');
    await expect(cells.length).toBe(40); // all mounted in DOM
    const visibleCells = Array.from(cells).filter(
      (el) => (el as HTMLElement).style.display !== 'none' && el.checkVisibility?.()
    );
    await expect(visibleCells.length).toBeLessThanOrEqual(8);
  },
});

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
