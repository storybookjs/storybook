import React, { type FC } from 'react';

import { expect, userEvent, waitFor, within } from 'storybook/test';

import preview from '../../../../../../.storybook/preview.tsx';
import { IFRAME_RESIZE_CONTEXT } from '../../../../shared/constants/iframe-resize.ts';
import { IconSymbols } from '../../sidebar/IconSymbols.tsx';
import type { StoryInfo } from '../review-types.ts';
import { CollectionGrid, type CollectionGridProps } from './CollectionGrid.tsx';

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
  decorators: [
    (Story) => (
      <>
        <IconSymbols />
        <Story />
      </>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    chromatic: {
      ignoreSelectors: ['[data-testid="review-collection-grid-cell"] iframe'],
    },
  },
  args: {
    storyIds: demoStoryIds,
    storyInfo: demoStoryInfo,
    getStoryPreviewHref: (storyId: string) =>
      `iframe.html?id=${encodeURIComponent(storyId)}&viewMode=story&embed=true&freeze=finished`,
  },
});

const previewHref = (storyId: string) =>
  `iframe.html?id=${encodeURIComponent(storyId)}&viewMode=story&embed=true&freeze=finished`;

const dispatchIframeResize = (cell: HTMLElement, width: number, height: number) => {
  const contentWindow = cell.querySelector('iframe')?.contentWindow;
  if (!contentWindow) {
    throw new Error('Preview iframe has no contentWindow');
  }
  window.dispatchEvent(
    new MessageEvent('message', {
      data: JSON.stringify({ context: IFRAME_RESIZE_CONTEXT, width, height }),
      source: contentWindow,
    })
  );
};

/** Loader cleared after iframe src is assigned and resize is applied. */
const waitForCellPreviewSettled = async (
  cell: HTMLElement,
  dimensions = { width: 320, height: 240 }
) => {
  await waitFor(() => {
    expect(cell.querySelector('iframe')?.getAttribute('src')).toContain('embed=true');
  });
  dispatchIframeResize(cell, dimensions.width, dimensions.height);
  await waitFor(() => {
    expect(within(cell).queryByTestId('review-preview-loading')).not.toBeInTheDocument();
    expect(Number(cell.querySelector('iframe')?.getAttribute('data-content-width'))).toBe(
      dimensions.width
    );
  });
};

export const Default = meta.story({
  play: async ({ canvasElement }) => {
    const cells = await within(canvasElement).findAllByTestId('review-collection-grid-cell');
    await waitFor(() => {
      for (const cell of cells) {
        const cellWidth = cell.getBoundingClientRect().width;
        const frame = cell.querySelector<HTMLElement>(
          '[data-testid="review-collection-grid-frame"]'
        );
        expect(frame).toBeTruthy();
        expect(frame!.getBoundingClientRect().width).toBeLessThanOrEqual(cellWidth + 1);
      }
    });
  },
});

export const QueuedPreviewShowsLoader = meta.story({
  args: {
    storyIds: [
      'manager-main--default',
      'manager-settings-aboutscreen--default',
      'manager-sidebar-sidebar--simple',
      'button-component--base',
      'button-component--variants',
    ],
    showAll: true,
  },
  globals: { viewport: { value: 'desktop' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const cells = await canvas.findAllByTestId('review-collection-grid-cell');
    expect(cells.length).toBe(5);

    await waitFor(() => {
      const started = cells.filter((cell) => cell.querySelector('iframe[src]'));
      expect(started.length).toBeGreaterThanOrEqual(3);
    });

    const queuedCells = cells.filter((cell) => !cell.querySelector('iframe[src]'));
    expect(queuedCells.length).toBeGreaterThan(0);
    for (const cell of queuedCells) {
      expect(within(cell).getByTestId('review-preview-loading')).toBeInTheDocument();
    }
  },
});

export const PreviewLoadingSettle = meta.story({
  args: {
    storyIds: ['manager-main--default'],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const cell = await canvas.findByTestId('review-collection-grid-cell');
    await waitForCellPreviewSettled(cell);

    // Duplicate iframe.resize payloads should not leave the loader stuck.
    dispatchIframeResize(cell, 320, 240);
    expect(within(cell).queryByTestId('review-preview-loading')).not.toBeInTheDocument();
  },
});

const StorySwapHarness: FC<Partial<CollectionGridProps>> = () => {
  const [storyIds, setStoryIds] = React.useState(['manager-main--default']);
  const storyInfo: Record<string, StoryInfo> = {
    'manager-main--default': demoStoryInfo['manager-main--default'],
    'manager-settings-aboutscreen--default': demoStoryInfo['manager-settings-aboutscreen--default'],
  };

  return (
    <div>
      <button
        type="button"
        data-testid="swap-preview-story"
        onClick={() => setStoryIds(['manager-settings-aboutscreen--default'])}
      >
        Swap story
      </button>
      <CollectionGrid storyIds={storyIds} storyInfo={storyInfo} getStoryPreviewHref={previewHref} />
    </div>
  );
};

export const PreviewRemountOnStoryChange = meta.story({
  render: () => <StorySwapHarness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const cell = await canvas.findByTestId('review-collection-grid-cell');
    await waitForCellPreviewSettled(cell);

    expect(cell.querySelector('iframe')?.title).toBe('manager-main--default');

    await userEvent.click(canvas.getByTestId('swap-preview-story'));

    let nextCell: HTMLElement | undefined;
    await waitFor(async () => {
      nextCell = await canvas.findByTestId('review-collection-grid-cell');
      expect(nextCell.querySelector('iframe')?.title).toBe('manager-settings-aboutscreen--default');
    });
    await waitForCellPreviewSettled(nextCell!, { width: 280, height: 180 });
  },
});

// On a narrow (mobile) container the grid drops to a single column and caps at
// two rows, so eight stories overflow into the "Review all" affordance.
export const ManyStoriesOverflow = meta.story({
  globals: { viewport: { value: 'mobile1' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('button', { name: /Review all/i })).toBeInTheDocument();
    const reviewAllFrame = canvasElement.querySelector('[data-review-all] > :first-child');
    await expect(reviewAllFrame).toBeTruthy();
    await waitFor(() => {
      expect((reviewAllFrame as HTMLElement).getBoundingClientRect().height).toBeGreaterThanOrEqual(
        50
      );
    });
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

    const frames = Array.from(cells).map((cell) =>
      cell.querySelector<HTMLElement>('[data-testid="review-collection-grid-frame"]')
    );
    await waitFor(() => {
      expect(frames.every((frame) => (frame?.clientHeight ?? 0) > 0)).toBe(true);
      for (const cell of cells) {
        const cellWidth = (cell as HTMLElement).getBoundingClientRect().width;
        const frame = cell.querySelector<HTMLElement>(
          '[data-testid="review-collection-grid-frame"]'
        );
        expect(frame).toBeTruthy();
        expect(frame!.getBoundingClientRect().width).toBeLessThanOrEqual(cellWidth + 1);
      }
    });
    const [firstHeight, secondHeight] = frames.map(
      (frame) => frame?.getBoundingClientRect().height ?? 0
    );
    expect(Math.abs(firstHeight - secondHeight)).toBeLessThanOrEqual(2);
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

    const reviewAllFrame = canvasElement.querySelector('[data-review-all] > :first-child');
    await expect(reviewAllFrame).toBeTruthy();
    await waitFor(() => {
      expect((reviewAllFrame as HTMLElement).clientHeight).toBeGreaterThan(0);
    });
    const reviewAllHeight = (reviewAllFrame as HTMLElement).clientHeight;
    const getRowNeighborHeights = () =>
      visibleCells
        .slice(-3)
        .map((cell) => (cell.firstElementChild as HTMLElement | null)?.clientHeight ?? 0);
    await waitFor(() => {
      expect(getRowNeighborHeights().every((height) => height > 0)).toBe(true);
    });
    for (const height of getRowNeighborHeights()) {
      expect(height).toBe(reviewAllHeight);
    }
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

export const FrameFitsCellAfterResize = meta.story({
  args: {
    storyIds: ['manager-main--default'],
  },
  globals: { viewport: { value: 'desktop' } },
  play: async ({ canvasElement }) => {
    const cell = await within(canvasElement).findByTestId('review-collection-grid-cell');
    await waitForCellPreviewSettled(cell, { width: 1280, height: 800 });
    await waitFor(() => {
      const cellWidth = cell.getBoundingClientRect().width;
      const frame = cell.querySelector<HTMLElement>('[data-testid="review-collection-grid-frame"]');
      expect(frame).toBeTruthy();
      expect(frame!.getBoundingClientRect().width).toBeLessThanOrEqual(cellWidth + 1);
    });
  },
});
