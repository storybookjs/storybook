import React from 'react';

import type { StatusesByStoryIdAndTypeId } from 'storybook/internal/types';

import type { Meta, StoryObj } from '@storybook/react-vite';

import type {
  ComponentEntry,
  DocsEntry,
  GroupEntry,
  IndexHash,
  StoryEntry,
  TestEntry,
} from 'storybook/manager-api';
import { ManagerContext } from 'storybook/manager-api';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { defaultShortcuts } from '../../settings/defaultShortcuts.tsx';
import { LayoutProvider } from '../layout/LayoutProvider.tsx';
import { IconSymbols } from './IconSymbols.tsx';
import { DEFAULT_REF_ID } from './Sidebar.tsx';
import { SidebarScrollArea } from './SidebarScrollArea.tsx';
import { Tree } from './Tree.tsx';

/**
 * TreeNode is a react-aria TreeItem. It renders only inside a react-aria Tree collection, so these
 * stories use a small `<Tree />` harness to show each node type and state.
 */

const groupItem: GroupEntry = {
  type: 'group',
  id: 'components',
  name: 'Components',
  tags: [],
  depth: 0,
  children: ['button'],
};
const componentItem: ComponentEntry = {
  type: 'component',
  id: 'button',
  name: 'Button',
  tags: [],
  depth: 1,
  children: ['button-autodocs--docs', 'button-primary', 'button-secondary'],
  parent: 'components',
};
const docsItem: DocsEntry = {
  type: 'docs',
  id: 'button-autodocs--docs',
  name: 'Docs',
  title: 'Components/Button',
  importPath: 'src/Button.stories.tsx',
  tags: [],
  depth: 2,
  parent: 'button',
  prepared: true,
};
const storyBranchItem: StoryEntry = {
  type: 'story',
  subtype: 'story',
  id: 'button-primary',
  name: 'Primary variant',
  title: 'Components/Button',
  importPath: 'src/Button.stories.tsx',
  exportName: 'Primary',
  tags: [],
  depth: 2,
  children: ['button-primary-isclickable'],
  parent: 'button',
  prepared: true,
};
const testItem: TestEntry = {
  type: 'story',
  subtype: 'test',
  id: 'button-primary-isclickable',
  name: 'is clickable',
  title: 'Components/Button',
  exportName: 'IsClickable',
  importPath: 'src/Button.stories.tsx',
  tags: [],
  depth: 3,
  parent: 'button-primary',
  prepared: true,
};
const storyLeafItem: StoryEntry = {
  type: 'story',
  subtype: 'story',
  id: 'button-secondary',
  name: 'Secondary variant',
  title: 'Components/Button',
  importPath: 'src/Button.stories.tsx',
  exportName: 'Secondary',
  tags: [],
  depth: 2,
  children: [],
  parent: 'button',
  prepared: true,
};

const index = Object.fromEntries(
  [groupItem, componentItem, docsItem, storyBranchItem, testItem, storyLeafItem].map((item) => [
    item.id,
    item,
  ])
) as IndexHash;

const longName =
  'A very very very very very very very very very very very very very very long node name that should ellipsize';

const longNameIndex = Object.fromEntries(
  Object.entries(index).map(([id, item]) => [id, { ...item, name: `${item.name} — ${longName}` }])
) as IndexHash;

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
    getElements: fn(() => ({})).mockName('api::getElements'),
    getData: fn().mockName('api::getData'),
  },
};

const meta = {
  component: Tree,
  title: 'Sidebar/TreeNode',
  excludeStories: /.*Data$/,
  globals: { sb_theme: 'side-by-side' },
  parameters: { layout: 'padded' },
  decorators: [
    (storyFn) => (
      <ManagerContext.Provider value={managerContext}>
        <LayoutProvider>
          <IconSymbols />
          <div style={{ maxWidth: 280, height: 400, display: 'flex' }}>
            <SidebarScrollArea>{storyFn()}</SidebarScrollArea>
          </div>
        </LayoutProvider>
      </ManagerContext.Provider>
    ),
  ],
  args: {
    refId: DEFAULT_REF_ID,
    data: index,
    selectedStoryId: null,
    onSelectStoryId: fn(),
  },
} satisfies Meta<typeof Tree>;

export default meta;

type Story = StoryObj<typeof meta>;

/** All node types at once: group, component, docs, story with tests, test, and story leaf. */
export const AllTypes: Story = {
  args: {
    // Selection of the deepest test expands the whole ancestor chain and shows every node type.
    selectedStoryId: testItem.id,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Components')).toBeInTheDocument();
    await expect(await canvas.findByText('Button')).toBeInTheDocument();
    await expect(await canvas.findByText('Docs')).toBeInTheDocument();
    await expect(await canvas.findByText('Primary variant')).toBeInTheDocument();
    await expect(await canvas.findByText('is clickable')).toBeInTheDocument();
    await expect(await canvas.findByText('Secondary variant')).toBeInTheDocument();

    // Addons and end-to-end tests select rows by class and node type, so both must stay on the row.
    const nodeTypeOf = (id: string) =>
      canvasElement
        .querySelector(`.sidebar-item[data-item-id="${id}"]`)
        ?.getAttribute('data-nodetype');
    await expect(nodeTypeOf(groupItem.id)).toBe('group');
    await expect(nodeTypeOf(componentItem.id)).toBe('component');
    await expect(nodeTypeOf(docsItem.id)).toBe('document');
    await expect(nodeTypeOf(storyLeafItem.id)).toBe('story');
    await expect(nodeTypeOf(testItem.id)).toBe('test');
  },
};

/** Collapsed root: only the top-level group is visible until expanded. */
export const Collapsed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Components')).toBeInTheDocument();
    await expect(canvas.queryByText('Button')).not.toBeInTheDocument();
  },
};

/** Clicking a collapsed branch expands it without navigating. */
export const ExpandOnClick: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const group = await canvas.findByText('Components');
    await userEvent.click(group);
    await expect(await canvas.findByText('Button')).toBeInTheDocument();
    await expect(args.onSelectStoryId).not.toHaveBeenCalled();

    // React-aria keeps data-focused on the row the click focused. Only the pointer and keyboard
    // focus may highlight a row, so the row must lose its highlight once the pointer leaves it.
    const row = canvasElement.querySelector<HTMLElement>(`[data-item-id="${groupItem.id}"]`)!;
    await expect(row).toHaveAttribute('data-focused', 'true');
    await expect(row).not.toHaveAttribute('data-focus-visible');
    await userEvent.unhover(row);
    await waitFor(() => {
      const highlight = getComputedStyle(row, '::before').backgroundColor;
      expect(highlight).toMatch(/^(transparent|rgba\(0, 0, 0, 0\))$/);
    });
  },
};

/** Clicking a story leaf navigates to it. */
export const SelectLeafOnClick: Story = {
  args: {
    selectedStoryId: storyBranchItem.id,
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const leaf = await canvas.findByText('Secondary variant');
    await userEvent.click(leaf);
    await expect(args.onSelectStoryId).toHaveBeenCalledWith('button-secondary');
  },
};

/** The selected story is marked as selected for assistive technology. */
export const Selected: Story = {
  args: {
    selectedStoryId: storyLeafItem.id,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const leafLabel = await canvas.findByText('Secondary variant');
    const treeItem = leafLabel.closest('[data-item-id]');
    await expect(treeItem).toHaveAttribute('data-selected', 'true');
  },
};

export const testStatusesData: StatusesByStoryIdAndTypeId = {
  [storyLeafItem.id]: {
    'sb-test': {
      value: 'status-value:error',
      title: 'Component tests',
      description: 'One test failed',
      storyId: storyLeafItem.id,
      typeId: 'sb-test',
      sidebarContextMenu: true,
    },
  },
  [testItem.id]: {
    'sb-test': {
      value: 'status-value:success',
      title: 'Component tests',
      description: 'All tests passed',
      storyId: testItem.id,
      typeId: 'sb-test',
      sidebarContextMenu: true,
    },
  },
};

/** Status icons roll up from leaves onto branches, and color the affected rows. */
export const WithStatuses: Story = {
  args: {
    selectedStoryId: testItem.id,
    allStatuses: testStatusesData,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const statusIcons = await canvas.findAllByTestId('tree-status-button');
    await expect(statusIcons.length).toBeGreaterThan(0);
  },
};

/** Long names ellipsize instead of wrapping or overflowing. */
export const LongNames: Story = {
  args: {
    data: longNameIndex,
    selectedStoryId: testItem.id,
  },
};

export const LongNamesDark: Story = {
  ...LongNames,
  globals: { sb_theme: 'dark' },
};
