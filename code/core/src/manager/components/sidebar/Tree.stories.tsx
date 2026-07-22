import React, { useState } from 'react';

import {
  type Addon_Collection,
  type Addon_TestProviderType,
  Addon_TypesEnum,
  type StatusesByStoryIdAndTypeId,
} from 'storybook/internal/types';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { action } from 'storybook/actions';
import { type ComponentEntry, type IndexHash, ManagerContext } from 'storybook/manager-api';
import { expect, fn, screen, userEvent, within } from 'storybook/test';

import { defaultShortcuts } from '../../settings/defaultShortcuts.tsx';
import { IconSymbols } from './IconSymbols.tsx';
import { DEFAULT_REF_ID } from './Sidebar.tsx';
import { Tree } from './Tree.tsx';
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
    docsMode: false,
    isBrowsing: true,
    isMain: true,
    refId: DEFAULT_REF_ID,
    setHighlightedItemId: action('setHighlightedItemId'),
  },
  render: (args) => {
    const [selectedId, setSelectedId] = useState(storyId);
    return (
      <Tree
        {...args}
        data={index}
        selectedStoryId={selectedId}
        onSelectStoryId={setSelectedId}
        highlightedRef={{ current: { itemId: selectedId, refId: DEFAULT_REF_ID } }}
      />
    );
  },
};
export const Dark: Story = {
  ...Full,
  globals: { sb_theme: 'dark' },
};

export const SingleStoryComponents: Story = {
  args: {
    docsMode: false,
    isBrowsing: true,
    isMain: true,
    refId: DEFAULT_REF_ID,
    setHighlightedItemId: action('setHighlightedItemId'),
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
        highlightedRef={{ current: { itemId: selectedId, refId: DEFAULT_REF_ID } }}
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
        docsMode={false}
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
        highlightedRef={{ current: { itemId: selectedId, refId: DEFAULT_REF_ID } }}
        setHighlightedItemId={action('setHighlightedItemId')}
        selectedStoryId={selectedId}
        onSelectStoryId={setSelectedId}
      />
    );
  },
};

// SkipToCanvas Link only shows on desktop widths
export const SkipToCanvasLinkFocused: Story = {
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
    const screen = await within(canvasElement);
    const link = await screen.findByText('Skip to content');

    await link.focus();

    await expect(link).toBeVisible();
  },
};

// SkipToCanvas Link only shows on desktop widths
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
  contextOverride?: { state?: Record<string, unknown> }
): Story {
  return {
    args: {
      docsMode: false,
      isBrowsing: true,
      isMain: true,
      refId: DEFAULT_REF_ID,
      setHighlightedItemId: action('setHighlightedItemId'),
      allStatuses,
    },
    decorators: contextOverride
      ? [
          (storyFn) => (
            <ManagerContext.Provider
              value={{
                ...managerContext,
                state: { ...managerContext.state, ...contextOverride.state },
              }}
            >
              <IconSymbols />
              {storyFn()}
            </ManagerContext.Provider>
          ),
        ]
      : undefined,
    render: (args) => {
      const [selectedId, setSelectedId] = useState(dualSlotStoryId);
      return (
        <Tree
          {...args}
          data={dualSlotData}
          selectedStoryId={selectedId}
          onSelectStoryId={setSelectedId}
          highlightedRef={{ current: { itemId: selectedId, refId: DEFAULT_REF_ID } }}
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
  { state: { includedStatusFilters: ['status-value:modified'] } }
);

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
      highlightedRef={{ current: { itemId: selectedId, refId: DEFAULT_REF_ID } }}
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
    { state: { includedStatusFilters: ['status-value:modified'] } }
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // modified filter is active — icon should be visible at story leaf and parent branch
    const buttons = await canvas.findAllByTestId('tree-change-status-button');
    await expect(buttons.length).toBeGreaterThanOrEqual(1);
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
    await expect(buttons.length).toBeGreaterThanOrEqual(1);
  },
};
