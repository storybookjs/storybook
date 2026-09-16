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
import { SidebarScrollArea } from './SidebarScrollArea.tsx';
import { Tree } from './Tree.tsx';
import { TREE_ROW_HEIGHT } from './treeGeometry.ts';
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
    // The sidebar gives every tree one shared scroll area; a tree does not scroll itself.
    // The sidebar gives every tree one shared scroll area; a tree does not scroll itself. A story
    // that needs the rows to overflow sets `parameters.scrollAreaHeight` to bound it.
    (storyFn, { parameters }) => (
      <ManagerContext.Provider value={managerContext}>
        <IconSymbols />
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            height: parameters.scrollAreaHeight,
          }}
        >
          <SidebarScrollArea>{storyFn()}</SidebarScrollArea>
        </div>
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
    refId: DEFAULT_REF_ID,
  },
  render: (args) => {
    const [selectedId, setSelectedId] = useState(storyId);
    return (
      <Tree {...args} data={index} selectedStoryId={selectedId} onSelectStoryId={setSelectedId} />
    );
  },
};

/**
 * The virtualizer must place rows exactly where the geometry model puts them: a 28px pitch, plus
 * the section gap a row carries as top padding when it starts a new top-level section. Estimated
 * heights would let unmeasured rows drift from the model after deep links, misplacing the sticky
 * rows, the indent lines, and scroll targeting.
 */
export const RowsMatchModelPitch: Story = {
  args: {
    refId: DEFAULT_REF_ID,
  },
  render: (args) => {
    const [selectedId, setSelectedId] = useState(storyId);
    return (
      <Tree {...args} data={index} selectedStoryId={selectedId} onSelectStoryId={setSelectedId} />
    );
  },
  play: async ({ canvasElement }) => {
    // Expand the first branch so a later top-level section follows deeper rows and gets the gap.
    const firstRow = canvasElement.querySelector<HTMLElement>('[data-item-id]')!;
    await waitFor(() => {
      expect(getComputedStyle(firstRow).pointerEvents).not.toBe('none');
    });
    await userEvent.click(firstRow);

    await waitFor(() => {
      const rows = Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-item-id]'))
        .map((el) => ({ el, top: el.getBoundingClientRect().top }))
        .sort((a, b) => a.top - b.top);
      expect(rows.length).toBeGreaterThan(2);
      let sawSectionGap = false;
      for (let i = 1; i < rows.length; i += 1) {
        // The section gap is padding inside the section-starting row's own box, so it widens the
        // step from that row to the next one.
        const gap = parseFloat(getComputedStyle(rows[i - 1].el).paddingBlockStart);
        sawSectionGap ||= gap > 0;
        expect(rows[i].top - rows[i - 1].top).toBe(TREE_ROW_HEIGHT + gap);
      }
      expect(sawSectionGap).toBe(true);

      // The tree's reported height must reach exactly to its last row, or the next block in the
      // sidebar's shared scroll area would overlap the tree.
      const treeBottom = canvasElement
        .querySelector('[role="treegrid"]')!
        .getBoundingClientRect().bottom;
      const lastRowBottom = Math.max(...rows.map((r) => r.el.getBoundingClientRect().bottom));
      expect(Math.round(treeBottom - lastRowBottom)).toBe(0);
    });
  },
};

/**
 * Escape pressed on a focused row must reach ancestors unconsumed. The mobile menu drawer hosts
 * the tree in a modal that closes on an unconsumed Escape, and react-aria would otherwise swallow
 * the key on every press to clear a selection that is controlled and never empty.
 */
export const EscapeReachesAncestors: Story = {
  args: {
    refId: DEFAULT_REF_ID,
  },
  render: (args) => {
    const [selectedId, setSelectedId] = useState(storyId);
    return (
      <Tree {...args} data={index} selectedStoryId={selectedId} onSelectStoryId={setSelectedId} />
    );
  },
  decorators: [
    (storyFn) => (
      <div
        style={{ display: 'contents' }}
        data-testid="escape-recorder"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.currentTarget.dataset.escapeArrived = String(!event.nativeEvent.defaultPrevented);
          }
        }}
      >
        {storyFn()}
      </div>
    ),
  ],
  play: async ({ canvas, canvasElement }) => {
    const row = canvasElement.querySelector<HTMLElement>('[data-item-id]')!;
    await waitFor(() => {
      expect(getComputedStyle(row).pointerEvents).not.toBe('none');
    });
    await userEvent.click(row);
    // The virtualizer can re-render on selection and drop focus to <body>, where Escape would
    // bypass the tree entirely and prove nothing.
    await waitFor(() => {
      const active = canvasElement.ownerDocument.activeElement;
      expect(active?.closest('[data-item-id]')).toBeTruthy();
    });
    await userEvent.keyboard('{Escape}');
    expect(canvas.getByTestId('escape-recorder').dataset.escapeArrived).toBe('true');
  },
};
export const Dark: Story = {
  ...Full,
  globals: { sb_theme: 'dark' },
};

export const SingleStoryComponents: Story = {
  args: {
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
  // The modified branch icon renders only while the modified status filter is active. Activate the
  // filter, so that both slots (change and test) are visible.
  ['status-value:modified']
);

WithChangeDetectionAndTestStatus.play = async ({ canvasElement }) => {
  // Each slot renders its own icon on the leaf row: the change status and the test status.
  const leafRow = canvasElement.querySelector(`[data-item-id="${dualSlotStoryId}"]`)!;
  await waitFor(() => {
    expect(leafRow.querySelector('[data-testid="tree-change-status-button"]')).not.toBeNull();
    expect(leafRow.querySelector('[data-testid="tree-test-status-button"]')).not.toBeNull();
  });
};

/**
 * Ctrl+Shift+U flow: the tree opens the menu for the selected story when the shortcut's channel
 * event fires and prepends a "Go to story" navigation item, one Tab away from the focused popover
 * container. Statuses stay on the rows; the menu carries navigation and provider entries.
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

    // Opening via keyboard autofocuses the first actionable item ("Go to story") so it can be
    // operated without a Tab first. Pointer opens keep focus on the container instead (see the
    // SomeContextContent story).
    await waitFor(() =>
      expect(within(popover).getByText('Go to story').closest('button')).toHaveFocus()
    );

    // Status links were removed from the context menu; statuses stay on the row itself.
    expect(within(popover).queryByText('Vitest')).not.toBeInTheDocument();
    expect(within(popover).queryByText('Change Detection')).not.toBeInTheDocument();
  },
};

/**
 * Pressing Enter on the ⋯ trigger counts as keyboard entry, just like Ctrl+Shift+U: the menu opens
 * with the "Go to story" navigation item and autofocuses it. A mouse click on the same trigger
 * opens with pointer entry and leaves focus on the container (see WithContextContent).
 */
export const ContextMenuEnterOnTrigger: Story = {
  ...makeDualSlotStory({
    [dualSlotStoryId]: {
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

    // Focus the row so its ⋯ trigger (revealed on focus-within) becomes focusable, then move
    // focus to the trigger and activate it with Enter.
    const row = canvasElement.querySelector<HTMLElement>(`[data-item-id="${dualSlotStoryId}"]`)!;
    await userEvent.click(row);
    const trigger = within(row).getByTestId('context-menu');
    trigger.focus();
    await userEvent.keyboard('{Enter}');

    const popover = await screen.findByRole('dialog');
    await waitFor(() =>
      expect(within(popover).getByText('Go to story').closest('button')).toHaveFocus()
    );
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

const stickyIndex: IndexHash = {
  ...index,
  'webapp-screens': {
    ...index['webapp-screens'],
    renderLabel: (item) => <span>{`Custom ${item.name}`}</span>,
  },
};

export const StickyAncestors: Story = {
  // Short enough that the ancestors of the selected row must become sticky.
  parameters: { scrollAreaHeight: 320 },
  args: {
    refId: DEFAULT_REF_ID,
  },
  render: (args) => {
    const [selectedId, setSelectedId] = useState(stickyStoryId);
    return (
      <div data-testid="sticky-harness">
        <Tree
          {...args}
          data={stickyIndex}
          selectedStoryId={selectedId}
          onSelectStoryId={setSelectedId}
        />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    // The tree is the scroll container. The sticky ancestors render in an overlay above it.
    const scroller = canvasElement.querySelector<HTMLElement>(
      '[data-testid="sidebar-scroll-area"]'
    )!;
    const overlayIds = () =>
      [
        ...canvasElement.querySelectorAll('[data-testid="sticky-overlay"] [data-sticky-item-id]'),
      ].map((el) => el.getAttribute('data-sticky-item-id'));
    const frame = () =>
      new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    // The tree centers the selected deep story on mount. The overlay then shows a suffix of its
    // ancestor chain, in order, and never the leaf itself.
    await waitFor(() => {
      const ids = overlayIds();
      expect(ids.length).toBeGreaterThan(0);
      expect(stickyChainIds.join(',')).toContain(ids.join(','));
      expect(ids).not.toContain(stickyStoryId);
    });

    await expect(
      canvasElement.querySelector('[data-sticky-item-id="webapp-screens"]')
    ).toHaveTextContent('Custom Webapp screens');

    // A sticky branch carries the icons of the scrolling rows: the type icon at rest and the
    // chevron on hover. A sticky root has no type icon and always shows the chevron.
    const stickyBranch = canvasElement.querySelector(
      `[data-sticky-item-id="${stickyChainIds[1]}"]`
    )!;
    expect(stickyBranch.querySelector('.static-only use')).not.toBeNull();
    expect(stickyBranch.querySelector('.hover-only svg')).not.toBeNull();
    const stickyRoot = canvasElement.querySelector('[data-sticky-item-id="webapp-screens"]')!;
    expect(stickyRoot.querySelector('use')).toBeNull();
    expect(stickyRoot.querySelector('[data-testid="sticky-collapse"] svg')).not.toBeNull();

    // Every row carries its own indent lines, and a sticky copy's align with the scrolling rows'.
    const treeLeft = canvasElement.querySelector('[role="treegrid"]')!.getBoundingClientRect().left;
    const stickyLine = stickyBranch.querySelector('[data-indent-line]')!;
    expect(Math.round(stickyLine.getBoundingClientRect().left - treeLeft)).toBe(13);
    const naturalLine = canvasElement.querySelector('[role="treegrid"] [data-indent-line]')!;
    expect(Math.round(naturalLine.getBoundingClientRect().left - treeLeft)).toBe(13);

    // The rows around the selected story mark their shared line, which stays visible while the
    // tree is not hovered.
    const selectionSpan = canvasElement.querySelector('[data-indent-line][data-selection-line]')!;
    expect(selectionSpan).not.toBeNull();
    expect(getComputedStyle(selectionSpan).opacity).toBe('1');

    // The overlay membership must not change on a single-pixel scroll. It derives from the row
    // offsets alone, never from the rows that are already sticky.
    const stable = overlayIds().join();
    for (const delta of [-1, 1, -1]) {
      scroller.scrollTop += delta;
      await frame();
      expect(overlayIds().join()).toBe(stable);
    }

    // At the very top no row is sticky.
    scroller.scrollTop = 0;
    await waitFor(() => {
      expect(overlayIds()).toEqual([]);
    });

    // A branch becomes sticky as soon as a scroll hides part of it. Expand the first top-level
    // branch and move it 10px past the top of the viewport. A collapsed branch never becomes
    // sticky, because the next row is not one of its descendants.
    const firstRow = canvasElement.querySelector<HTMLElement>('[data-item-id]')!;
    const firstRowId = firstRow.getAttribute('data-item-id');
    // The virtualizer disables pointer events on rows briefly while scrolling.
    await waitFor(() => {
      expect(getComputedStyle(firstRow).pointerEvents).not.toBe('none');
    });
    await userEvent.click(firstRow);
    scroller.scrollTop = 10;
    await waitFor(() => {
      expect(overlayIds()).toEqual([firstRowId]);
    });

    // The sticky row hands its slot over one row before the header of the next section reaches
    // the stack, instead of covering that header.
    const subtreeBottom =
      canvasElement.querySelectorAll(`[data-item-id^="${firstRowId}"]`).length * TREE_ROW_HEIGHT;
    scroller.scrollTop = subtreeBottom - 2 * TREE_ROW_HEIGHT;
    await waitFor(() => {
      expect(overlayIds()).toEqual([firstRowId]);
    });
    scroller.scrollTop = subtreeBottom - TREE_ROW_HEIGHT;
    await waitFor(() => {
      expect(overlayIds()).toEqual([]);
    });
    scroller.scrollTop = 10;
    await waitFor(() => {
      expect(overlayIds()).toEqual([firstRowId]);
    });

    // A click on the sticky chevron collapses the node and moves its own row into the slot that
    // the sticky copy held.
    const stickyFirst = canvasElement.querySelector(`[data-sticky-item-id="${firstRowId}"]`)!;
    await userEvent.click(within(stickyFirst as HTMLElement).getByTestId('sticky-collapse'));
    await waitFor(() => {
      expect(overlayIds()).toEqual([]);
      expect(scroller.scrollTop).toBe(0);
      expect(
        canvasElement.querySelector(`[data-item-id="${firstRowId}"]`)?.getAttribute('aria-expanded')
      ).toBe('false');
    });

    // Keyboard entry falls back to the selected story when no row is focused, even though
    // its row sits far outside the viewport. (The scroll-into-view half of this behavior
    // is not observable here: under NODE_ENV=test react-aria sizes the scroll view as
    // Infinity and clamps its internal scroll offset to 0 on every render.)
    (canvasElement.ownerDocument.activeElement as HTMLElement | null)?.blur?.();
    const firstRowAfterCollapse = canvasElement.querySelector<HTMLElement>(
      `[data-item-id="${firstRowId}"]`
    )!;
    await waitFor(() => {
      expect(getComputedStyle(firstRowAfterCollapse).pointerEvents).not.toBe('none');
    });
    await userEvent.unhover(firstRowAfterCollapse);
    await waitFor(() => {
      expect(
        canvasElement.querySelector('[data-focused="true"]')?.getAttribute('data-item-id') ?? null
      ).toBeNull();
    });
    // The focus ref trails the DOM by one frame (the MutationObserver batches with rAF).
    await frame();
    const openMenuHandler = managerContext.api.on.mock.calls
      .filter(([event]: [string]) => event === SIDEBAR_OPEN_CONTEXT_MENU)
      .at(-1)?.[1];
    openMenuHandler();
    const popover = await screen.findByRole('dialog');
    expect(popover).toBeVisible();
    expect(within(popover).getByText('Go to story')).toBeVisible();
    await userEvent.keyboard('{Escape}');
  },
};

export const StickyAncestorsDark: Story = {
  ...StickyAncestors,
  globals: { sb_theme: 'dark' },
};

/**
 * Arrow-up navigation moves focus through the ancestors of the selected row, up into the rows the
 * sticky stack covers.
 *
 * The scroll that keeps the focused row clear of the sticky rows needs a real scroll environment,
 * so `e2e-internal/sidebar-scrolling.spec.ts` covers it: react-aria's virtual scroll view reports
 * an unbounded size under NODE_ENV=test, which makes the geometry here unrepresentative.
 */
export const StickyKeyboardReveal: Story = {
  parameters: { scrollAreaHeight: 320 },
  args: { refId: DEFAULT_REF_ID },
  render: (args) => {
    const [selectedId, setSelectedId] = useState(stickyStoryId);
    return (
      <div>
        <Tree
          {...args}
          data={stickyIndex}
          selectedStoryId={selectedId}
          onSelectStoryId={setSelectedId}
        />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const scroller = canvasElement.querySelector<HTMLElement>(
      '[data-testid="sidebar-scroll-area"]'
    )!;
    const overlay = () =>
      canvasElement.querySelector<HTMLElement>('[data-testid="sticky-overlay"]');
    const focusedRow = () =>
      canvasElement.querySelector<HTMLElement>('[data-item-id][data-focused="true"]');

    // On mount the tree centers the selected deep story, which makes its ancestors sticky.
    await waitFor(() => expect(overlay()).not.toBeNull());
    const leaf = canvasElement.querySelector<HTMLElement>(`[data-item-id="${stickyStoryId}"]`)!;
    // The virtualizer briefly disables pointer events on rows while it settles.
    await waitFor(() => expect(getComputedStyle(leaf).pointerEvents).not.toBe('none'));
    await userEvent.click(leaf);
    await waitFor(() => expect(focusedRow()?.getAttribute('data-item-id')).toBe(stickyStoryId));

    // Each ArrowUp moves focus to the row above, all the way into the rows the stack covers.
    const visited: string[] = [];
    let previous = stickyStoryId;
    for (let i = 0; i < 4; i += 1) {
      await userEvent.keyboard('{ArrowUp}');
      await waitFor(() => expect(focusedRow()?.getAttribute('data-item-id')).not.toBe(previous));
      previous = focusedRow()!.getAttribute('data-item-id')!;
      visited.push(previous);
    }
    expect(visited).toEqual([
      'webapp-screens-marketing-featuresscreens-documentscreen-componentexample',
      'webapp-screens-marketing-featuresscreens-documentscreen--base',
      'webapp-screens-marketing-featuresscreens-documentscreen',
      'webapp-screens-marketing-featuresscreens',
    ]);
  },
};

/**
 * Moving focus onto a collapsed branch with the arrow keys must leave it collapsed: focus is not
 * activation. react-aria's selectionBehavior="replace" makes selection follow focus, so without a
 * guard, arrowing past a branch would toggle it. Explicit activation (click, Enter, Space) still
 * expands it.
 */
export const ArrowFocusDoesNotToggleBranch: Story = {
  args: { refId: DEFAULT_REF_ID },
  render: (args) => {
    const [selectedId, setSelectedId] = useState(storyId);
    return (
      <Tree {...args} data={index} selectedStoryId={selectedId} onSelectStoryId={setSelectedId} />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const row = (id: string) => canvasElement.querySelector<HTMLElement>(`[data-item-id="${id}"]`);
    const focusedId = () =>
      canvasElement
        .querySelector('[data-item-id][data-focused="true"]')
        ?.getAttribute('data-item-id') ?? null;

    // emails is an expanded root; its first child is a leaf, its second a collapsed branch.
    await canvas.findByText('Introduction');
    expect(row('emails-buildnotification')).toHaveAttribute('aria-expanded', 'false');

    // Focus the leaf, then arrow down onto the collapsed branch.
    await userEvent.click(row('emails-introduction')!);
    await waitFor(() => expect(focusedId()).toBe('emails-introduction'));
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(focusedId()).toBe('emails-buildnotification'));

    // Focus landed on the branch but must not have expanded it.
    expect(row('emails-buildnotification')).toHaveAttribute('aria-expanded', 'false');

    // Pressing Enter on the focused branch still expands it.
    await userEvent.keyboard('{Enter}');
    await waitFor(() =>
      expect(row('emails-buildnotification')).toHaveAttribute('aria-expanded', 'true')
    );
  },
};

/** Plain arrow keys must move focus between rows (react-aria keyboard navigation). */
export const KeyboardNavigation: Story = {
  args: {
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
