import React, { useState } from 'react';

import {
  type Addon_Collection,
  type Addon_TestProviderType,
  Addon_TypesEnum,
  type StatusValue,
  type StatusesByStoryIdAndTypeId,
} from 'storybook/internal/types';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { type ComponentEntry, type IndexHash, ManagerContext } from 'storybook/manager-api';
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test';

import { SIDEBAR_OPEN_CONTEXT_MENU } from 'storybook/internal/core-events';

import { defaultShortcuts } from '../../settings/defaultShortcuts.tsx';
import { IconSymbols } from './IconSymbols.tsx';
import { DEFAULT_REF_ID } from './Sidebar.tsx';
import { Tree } from './Tree.tsx';
import { TREE_ROW_HEIGHT } from './TreeNode.tsx';
import { index } from './mockdata.large.ts';

const managerContext: any = {
  state: {
    docsOptions: {
      defaultName: 'Docs',
      autodocs: 'tag',
      docsMode: false,
    },
  },
  api: {
    on: fn().mockName('api::on'),
    off: fn().mockName('api::off'),
    once: fn().mockName('api::once'),
    emit: fn().mockName('api::emit'),
    getShortcutKeys: fn(() => defaultShortcuts).mockName('api::getShortcutKeys'),
    getCurrentStoryData: fn().mockName('api::getCurrentStoryData'),
    getElements: fn(
      () =>
        ({
          'component-tests': {
            type: Addon_TypesEnum.experimental_TEST_PROVIDER,
            id: 'component-tests',
            render: () => 'Component tests',
            sidebarContextMenu: () => <div>TEST_PROVIDER_CONTEXT_CONTENT</div>,
          },
          'visual-tests': {
            type: Addon_TypesEnum.experimental_TEST_PROVIDER,
            id: 'visual-tests',
            render: () => 'Visual tests',
            sidebarContextMenu: () => null,
          },
        }) satisfies Addon_Collection<Addon_TestProviderType>
    ),
    getData: fn().mockName('api::getData'),
  },
};

const meta = {
  component: Tree,
  title: 'Sidebar/Tree',
  excludeStories: /.*Data$/,
  globals: {
    sb_theme: 'light',
    viewport: { value: 'sized' },
  },
  parameters: {
    layout: 'fullscreen',
    viewport: {
      options: {
        sized: {
          name: 'Sized',
          styles: {
            width: '380px',
            height: '90%',
          },
        },
      },
    },
    chromatic: { viewports: [380] },
  },
  decorators: [
    (storyFn) => (
      <ManagerContext.Provider value={managerContext}>
        <IconSymbols />
        {storyFn()}
      </ManagerContext.Provider>
    ),
  ],
} as Meta<typeof Tree>;

export default meta;

// @ts-expect-error (non strict)
const storyId = Object.values(index).find((story) => story.type === 'story').id;

type Story = StoryObj<typeof meta>;

export const Full: Story = {
  args: {
    isBrowsing: true,
    isMain: true,
    refId: DEFAULT_REF_ID,
  },
  render: (args) => {
    const [selectedId, setSelectedId] = useState(storyId);
    return (
      <Tree {...args} data={index} selectedStoryId={selectedId} onSelectStoryId={setSelectedId} />
    );
  },
};
export const Dark: Story = {
  ...Full,
  globals: { sb_theme: 'dark' },
};

export const SingleStoryComponents: Story = {
  args: {
    isBrowsing: true,
    isMain: true,
    refId: DEFAULT_REF_ID,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The hoisted single-story component renders exactly one row — the story replaces the
    // component instead of appearing alongside a phantom component row.
    await canvas.findAllByText('🔥 Single');
    await expect(canvasElement.querySelectorAll('[data-item-id="single"]').length).toBe(0);
    await expect(canvasElement.querySelectorAll('[data-item-id="single--single"]').length).toBe(1);
  },
  render: (args) => {
    const [selectedId, setSelectedId] = useState('tooltip-tooltipbuildlist--default');
    return (
      <Tree
        {...args}
        // @ts-expect-error (non strict)
        data={{
          ...{
            single: {
              type: 'component',
              name: 'Single',
              id: 'single',
              parent: null,
              depth: 0,
              children: ['single--single'],
              renderLabel: () => <span>🔥 Single</span>,
            },
            'single--single': {
              type: 'story',
              subtype: 'story',
              id: 'single--single',
              title: 'Single',
              name: 'Single',
              tags: [],
              prepared: true,
              args: {},
              argTypes: {},
              initialArgs: {},
              depth: 1,
              parent: 'single',
              renderLabel: () => <span>🔥 Single</span>,
              importPath: './single.stories.js',
            },
          },
          ...Object.keys(index).reduce((acc, key) => {
            if (key === 'tooltip-tooltipselect--default') {
              acc['tooltip-tooltipselect--tooltipselect'] = {
                ...index[key],
                id: 'tooltip-tooltipselect--tooltipselect',
                name: 'TooltipSelect',
              };
              return acc;
            }
            if (key === 'tooltip-tooltipselect') {
              acc[key] = {
                ...(index[key] as ComponentEntry),
                children: ['tooltip-tooltipselect--tooltipselect'],
              };
              return acc;
            }
            if (key.startsWith('tooltip')) {
              acc[key] = index[key];
            }
            return acc;
          }, {} as IndexHash),
        }}
        selectedStoryId={selectedId}
        onSelectStoryId={setSelectedId}
      />
    );
  },
};

export const DocsOnlySingleStoryComponents = {
  render: () => {
    const [selectedId, setSelectedId] = useState('tooltip-tooltipbuildlist--default');
    return (
      <Tree
        isBrowsing
        isMain
        refId={DEFAULT_REF_ID}
        // @ts-expect-error (non strict)
        data={{
          ...{
            single: {
              type: 'component',
              name: 'Single',
              id: 'single',
              parent: null,
              depth: 0,
              children: ['single--docs'],
            },
            'single--docs': {
              type: 'docs',
              id: 'single--docs',
              title: 'Single',
              name: 'Single',
              tags: [],
              prepared: true,
              depth: 1,
              parent: 'single',
              importPath: './single.stories.js',
            },
          },
          ...Object.keys(index).reduce((acc, key) => {
            if (key === 'tooltip-tooltipselect--default') {
              acc['tooltip-tooltipselect--tooltipselect'] = {
                ...index[key],
                id: 'tooltip-tooltipselect--tooltipselect',
                name: 'TooltipSelect',
              };
              return acc;
            }
            if (key === 'tooltip-tooltipselect') {
              acc[key] = {
                ...(index[key] as ComponentEntry),
                children: ['tooltip-tooltipselect--tooltipselect'],
              };
              return acc;
            }
            if (key.startsWith('tooltip')) {
              acc[key] = index[key];
            }
            return acc;
          }, {} as IndexHash),
        }}
        selectedStoryId={selectedId}
        onSelectStoryId={setSelectedId}
      />
    );
  },
};

export const WithContextContent: Story = {
  ...DocsOnlySingleStoryComponents,
  parameters: {
    chromatic: { viewports: [1280] },
    viewport: {
      options: {
        desktop: {
          name: 'Desktop',
          styles: {
            width: '100%',
            height: '100%',
          },
        },
      },
    },
  },
  globals: {
    viewport: { value: 'desktop' },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const link = await canvas.findByText('TooltipBuildList');
    await userEvent.hover(link);

    const contextButton = await canvas.findAllByTestId('context-menu');
    await userEvent.click(contextButton[0]);

    const popover = screen.getByRole('dialog');
    await expect(popover).toBeVisible();
    expect(popover).toHaveTextContent('TEST_PROVIDER_CONTEXT_CONTENT');

    // Focus stays on the popover container on open — autofocusing the first item makes
    // screen readers announce it twice. The first Tab reaches the first actionable item.
    await waitFor(() => expect(popover).toHaveFocus());
    await userEvent.tab();
    await expect(within(popover).getByText('Open in editor').closest('button')).toHaveFocus();
  },
};

const dualSlotStoryId = storyId;
const dualSlotParentId = (index[dualSlotStoryId] as any).parent as string;

const getAncestorChain = (startId: string): IndexHash => {
  const chain: IndexHash = {};
  let currentId: string | null = startId;
  while (currentId && index[currentId]) {
    chain[currentId] = index[currentId];
    currentId = ((index[currentId] as any)?.parent as string | null) ?? null;
  }
  return chain;
};

const dualSlotData: IndexHash = {
  ...getAncestorChain(dualSlotParentId),
  [dualSlotParentId]: {
    ...(index[dualSlotParentId] as ComponentEntry),
    children: [dualSlotStoryId],
  },
  [dualSlotStoryId]: index[dualSlotStoryId],
};

function makeDualSlotStory(
  allStatuses: StatusesByStoryIdAndTypeId,
  includedStatusFilters?: StatusValue[]
): Story {
  return {
    args: {
      isBrowsing: true,
      isMain: true,
      refId: DEFAULT_REF_ID,
      allStatuses,
      includedStatusFilters,
    },
    render: (args) => {
      const [selectedId, setSelectedId] = useState(dualSlotStoryId);
      return (
        <Tree
          {...args}
          data={dualSlotData}
          selectedStoryId={selectedId}
          onSelectStoryId={setSelectedId}
        />
      );
    },
  };
}

export const WithChangeDetectionOnly: Story = makeDualSlotStory({
  [dualSlotStoryId]: {
    'storybook/change-detection': {
      storyId: dualSlotStoryId,
      typeId: 'storybook/change-detection',
      value: 'status-value:new',
      title: 'Change Detection',
      description: 'Story is new',
      sidebarContextMenu: false,
    },
  },
});

export const WithChangeDetectionAndTestStatus: Story = makeDualSlotStory(
  {
    [dualSlotStoryId]: {
      'storybook/change-detection': {
        storyId: dualSlotStoryId,
        typeId: 'storybook/change-detection',
        value: 'status-value:modified',
        title: 'Change Detection',
        description: 'Story is modified',
        sidebarContextMenu: false,
      },
      'storybook/vitest': {
        storyId: dualSlotStoryId,
        typeId: 'storybook/vitest',
        value: 'status-value:error',
        title: 'Vitest',
        description: 'Test failed',
      },
    },
  },
  // Modified branch icon only renders when the modified status filter is
  // active; activate it so the dual-slot design (change + test) is visible.
  ['status-value:modified']
);

/**
 * Ctrl+Shift+U flow: the tree opens the menu for the selected story when the shortcut's channel
 * event fires and prepends a "Go to story" navigation item, one Tab away from the focused popover
 * container. Status links describe their click action; opted-out statuses stay hidden.
 */
export const ContextMenuKeyboardEntry: Story = {
  ...makeDualSlotStory({
    [dualSlotStoryId]: {
      'storybook/change-detection': {
        storyId: dualSlotStoryId,
        typeId: 'storybook/change-detection',
        value: 'status-value:modified',
        title: 'Change Detection',
        description: 'Story is modified',
        sidebarContextMenu: false,
      },
      'storybook/vitest': {
        storyId: dualSlotStoryId,
        typeId: 'storybook/vitest',
        value: 'status-value:error',
        title: 'Vitest',
        description: 'Test failed',
      },
    },
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('marketing hero');

    // Simulate the global shortcut by invoking the handler the tree registered for the
    // shortcut's channel event. Registrations accumulate across stories in the mocked
    // api, so take the latest — earlier ones belong to unmounted trees.
    const registrations = managerContext.api.on.mock.calls.filter(
      ([event]: [string]) => event === SIDEBAR_OPEN_CONTEXT_MENU
    );
    const handler = registrations.at(-1)?.[1];
    await expect(handler).toBeDefined();
    handler();

    const popover = await screen.findByRole('dialog');

    // Focus stays on the popover container on open — autofocusing the first item makes
    // screen readers announce it twice. The first Tab reaches the "Go to story" item.
    await waitFor(() => expect(popover).toHaveFocus());
    await userEvent.tab();
    await expect(within(popover).getByText('Go to story').closest('button')).toHaveFocus();

    // Status links describe the click action, not the status — the row announces the status.
    await expect(
      within(popover).getByLabelText('Open Vitest results for this story')
    ).toBeVisible();
    // Change-detection statuses opt out of the context menu.
    expect(within(popover).queryByText('Change Detection')).not.toBeInTheDocument();
  },
};

export const WithTestStatusOnly: Story = makeDualSlotStory({
  [dualSlotStoryId]: {
    'storybook/vitest': {
      storyId: dualSlotStoryId,
      typeId: 'storybook/vitest',
      value: 'status-value:warning',
      title: 'Vitest',
      description: 'Test warning',
    },
  },
});

export const WithRelatedStatus: Story = {
  ...makeDualSlotStory({
    [dualSlotStoryId]: {
      'storybook/change-detection': {
        storyId: dualSlotStoryId,
        typeId: 'storybook/change-detection',
        value: 'status-value:affected',
        title: 'Change Detection',
        description: 'Story is related',
        sidebarContextMenu: false,
      },
    },
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // affected status is always hidden — no change-status icon should render
    await expect(canvas.queryByTestId('tree-change-status-button')).toBeNull();
  },
};

export const BranchWithChangeDetectionPriority: Story = makeDualSlotStory({
  [dualSlotStoryId]: {
    'storybook/change-detection': {
      storyId: dualSlotStoryId,
      typeId: 'storybook/change-detection',
      value: 'status-value:new',
      title: 'Change Detection',
      description: 'Story is new',
      sidebarContextMenu: false,
    },
    'storybook/vitest': {
      storyId: dualSlotStoryId,
      typeId: 'storybook/vitest',
      value: 'status-value:error',
      title: 'Vitest',
      description: 'Test failed',
    },
  },
});

BranchWithChangeDetectionPriority.render = (args) => {
  const [selectedId, setSelectedId] = useState(dualSlotParentId);
  return (
    <Tree
      {...args}
      data={dualSlotData}
      selectedStoryId={selectedId}
      onSelectStoryId={setSelectedId}
    />
  );
};

/**
 * A modified story with the modified filter active.
 * The change-status icon should be visible.
 */
export const WithModified: Story = {
  ...makeDualSlotStory(
    {
      [dualSlotStoryId]: {
        'storybook/change-detection': {
          storyId: dualSlotStoryId,
          typeId: 'storybook/change-detection',
          value: 'status-value:modified',
          title: 'Change Detection',
          description: 'Story is modified',
          sidebarContextMenu: false,
        },
      },
    },
    ['status-value:modified']
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // modified filter is active — icon must be visible on the story's own leaf row AND the
    // parent branch roll-up
    const buttons = await canvas.findAllByTestId('tree-change-status-button');
    await expect(buttons.length).toBeGreaterThanOrEqual(2);
    const leafRow = canvasElement.querySelector(`[data-item-id="${dualSlotStoryId}"]`);
    await expect(
      leafRow?.querySelector('[data-testid="tree-change-status-button"]')
    ).not.toBeNull();
  },
};

/**
 * A new story with no filters set.
 * The new status icon is always visible (not gated on a filter).
 */
export const WithNew: Story = {
  ...makeDualSlotStory({
    [dualSlotStoryId]: {
      'storybook/change-detection': {
        storyId: dualSlotStoryId,
        typeId: 'storybook/change-detection',
        value: 'status-value:new',
        title: 'Change Detection',
        description: 'Story is new',
        sidebarContextMenu: false,
      },
    },
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // new status is always shown at both leaf and branch levels
    const buttons = await canvas.findAllByTestId('tree-change-status-button');
    await expect(buttons.length).toBeGreaterThanOrEqual(2);
    const leafRow = canvasElement.querySelector(`[data-item-id="${dualSlotStoryId}"]`);
    await expect(
      leafRow?.querySelector('[data-testid="tree-change-status-button"]')
    ).not.toBeNull();
  },
};

// ─── Sticky ancestors of the topmost visible row (VSCode-style sticky scroll) ────────────────────

const stickyStoryId =
  'webapp-screens-marketing-featuresscreens-documentscreen-componentexample--base';
/** Ancestor chain of `stickyStoryId`, root-most first — the rows expected to pin when it is the topmost visible row. */
const stickyChainIds = [
  'webapp-screens',
  'webapp-screens-marketing',
  'webapp-screens-marketing-featuresscreens',
  'webapp-screens-marketing-featuresscreens-documentscreen',
  'webapp-screens-marketing-featuresscreens-documentscreen-componentexample',
];

export const StickyAncestors: Story = {
  args: {
    isBrowsing: true,
    isMain: true,
    refId: DEFAULT_REF_ID,
  },
  render: (args) => {
    const [selectedId, setSelectedId] = useState(stickyStoryId);
    return (
      <div data-testid="sticky-scroller" style={{ height: 320, overflowY: 'auto' }}>
        <Tree {...args} data={index} selectedStoryId={selectedId} onSelectStoryId={setSelectedId} />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const scroller = await canvas.findByTestId('sticky-scroller');
    const row = (id: string) =>
      canvasElement.querySelector<HTMLElement>(`[data-item-id="${CSS.escape(id)}"]`);
    const pinnedRows = () => canvasElement.querySelectorAll<HTMLElement>('[data-sticky-pinned]');
    const scrollerTop = () => scroller.getBoundingClientRect().top;

    await waitFor(() => expect(row(stickyStoryId)).not.toBeNull());

    // At the very top of the tree nothing is visually displaced: at most the topmost branch
    // row is marked (so it pins the instant it becomes partially hidden), sitting exactly at
    // its natural spot, and every row carrying a slot is actually in the pinned chain.
    scroller.scrollTop = 0;
    await waitFor(() => {
      const pinned = [...pinnedRows()];
      expect(pinned.length).toBeLessThanOrEqual(1);
      pinned.forEach((el) => {
        expect(Math.abs(el.getBoundingClientRect().top - scrollerTop())).toBeLessThanOrEqual(2);
      });
      canvasElement.querySelectorAll<HTMLElement>('[style*="--sticky-top"]').forEach((el) => {
        expect(el).toHaveAttribute('data-sticky-pinned');
      });
    });

    // A branch pins as soon as it is partially hidden, not only after scrolling fully past
    // it: nudge the deep chain's root 10px beyond the viewport top and it must already be
    // stuck at slot 0.
    const rootRow = row(stickyChainIds[0])!;
    scroller.scrollTop =
      scroller.scrollTop + rootRow.getBoundingClientRect().top - scrollerTop() + 10;
    await waitFor(() => {
      const r = row(stickyChainIds[0])!;
      expect(r).toHaveAttribute('data-sticky-pinned');
      expect(Math.abs(r.getBoundingClientRect().top - scrollerTop())).toBeLessThanOrEqual(2);
    });

    // Scroll so the deep story leaf is the topmost visible row: its strict ancestors pin,
    // stacked in order, while the leaf itself must never pin.
    const targetRow = row(stickyStoryId)!;
    scroller.scrollTop = scroller.scrollTop + targetRow.getBoundingClientRect().top - scrollerTop();
    await waitFor(() => {
      stickyChainIds.forEach((id, i) => {
        const ancestorRow = row(id);
        expect(ancestorRow).not.toBeNull();
        expect(ancestorRow!).toHaveAttribute('data-sticky-pinned');
        const { top } = ancestorRow!.getBoundingClientRect();
        expect(Math.abs(top - scrollerTop() - i * TREE_ROW_HEIGHT)).toBeLessThanOrEqual(2);
      });
      expect(row(stickyStoryId)!).not.toHaveAttribute('data-sticky-pinned');
    });

    // Scroll to the very bottom: the viewport has left the deep component's subtree, so its
    // row retracts and leaves no stale pin state behind (no holes in the tree).
    scroller.scrollTop = scroller.scrollHeight;
    await waitFor(() => {
      const componentRow = row(stickyChainIds[stickyChainIds.length - 1]);
      expect(componentRow).not.toBeNull();
      expect(componentRow!).not.toHaveAttribute('data-sticky-pinned');
      expect(componentRow!.style.getPropertyValue('--sticky-top')).toBe('');
    });

    // And back to the top: the whole stack releases (at most the topmost branch stays
    // marked, at its natural position).
    scroller.scrollTop = 0;
    await waitFor(() => {
      const pinned = [...pinnedRows()];
      expect(pinned.length).toBeLessThanOrEqual(1);
      pinned.forEach((el) => {
        expect(Math.abs(el.getBoundingClientRect().top - scrollerTop())).toBeLessThanOrEqual(2);
      });
    });
  },
};

export const StickyAncestorsDark: Story = {
  ...StickyAncestors,
  globals: { sb_theme: 'dark' },
};

/** Plain arrow keys must move focus between rows (react-aria keyboard navigation). */
export const KeyboardNavigation: Story = {
  args: {
    isBrowsing: true,
    isMain: true,
    refId: DEFAULT_REF_ID,
  },
  render: (args) => {
    const [selectedId, setSelectedId] = useState(storyId);
    return (
      <Tree {...args} data={index} selectedStoryId={selectedId} onSelectStoryId={setSelectedId} />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const first = await canvas.findByText('marketing hero');
    await userEvent.click(first);
    const focusedId = () =>
      canvasElement
        .querySelector('[data-item-id][data-focused="true"]')
        ?.getAttribute('data-item-id');
    await waitFor(() => expect(focusedId()).toBe('images--marketing-hero'));

    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(focusedId()).toBe('images--brand'));

    await userEvent.keyboard('{ArrowUp}');
    await waitFor(() => expect(focusedId()).toBe('images--marketing-hero'));
  },
};
