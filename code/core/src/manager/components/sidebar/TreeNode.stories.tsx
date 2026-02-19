import React from 'react';

import type { StatusByTypeId } from 'storybook/internal/types';

import type { Meta, StoryObj } from '@storybook/react-vite';

import type {
  API,
  BaseEntry,
  ComponentEntry,
  DocsEntry,
  GroupEntry,
  StoryEntry,
  TestEntry,
} from 'storybook/manager-api';
import { fn } from 'storybook/test';

import { LayoutProvider } from '../layout/LayoutProvider.tsx';
import { IconSymbols } from './IconSymbols.tsx';
import { DEFAULT_REF_ID } from './Sidebar.tsx';
import { Tree } from './Tree.tsx';
import { TreeNode } from './TreeNode.tsx';

const storyBranchItem: StoryEntry = {
  type: 'story',
  subtype: 'story',
  id: 'button-primary',
  name: 'Primary variant',
  title: 'Components/Button/Primary',
  importPath: 'src/Button.stories.tsx',
  exportName: 'Primary',
  tags: [],
  depth: 3,
  children: ['button-primary-isclickable'],
  parent: 'button',
  prepared: true,
};
const storyLeafItem: StoryEntry = {
  type: 'story',
  subtype: 'story',
  id: 'button-secondary',
  name: 'Secondary variant',
  title: 'Components/Button/Secondary',
  importPath: 'src/Button.stories.tsx',
  exportName: 'Secondary',
  tags: [],
  depth: 3,
  children: undefined,
  parent: 'button',
  prepared: true,
};
const testItem: TestEntry = {
  type: 'story',
  subtype: 'test',
  id: 'button-primary-isclickable',
  name: 'is clickable',
  title: 'Components/Button/Primary/IsClickable',
  exportName: 'IsClickable',
  importPath: 'src/Button.stories.tsx',
  tags: [],
  depth: 4,
  parent: 'button-primary',
  prepared: true,
};
const docsItem: DocsEntry = {
  type: 'docs',
  id: 'button-autodocs--docs',
  name: 'Button',
  title: 'Components/Button',
  importPath: 'src/Button.stories.tsx',
  tags: [],
  depth: 0,
  parent: 'button',
  prepared: true,
};
const orphanDocsItem: DocsEntry = {
  type: 'docs',
  id: 'intro--docs',
  name: 'Introduction',
  title: 'Introduction',
  importPath: 'stories/Intro.mdx',
  tags: [],
  depth: 0,
  parent: undefined,
  prepared: true,
};
const componentItem: ComponentEntry = {
  type: 'component',
  id: 'button',
  name: 'Button',
  tags: [],
  depth: 2,
  children: ['story-branch', 'story-leaf'],
  parent: 'components',
};
const groupItem: GroupEntry = {
  type: 'group',
  id: 'components',
  name: 'Components',
  tags: [],
  depth: 1,
  children: ['button'],
  parent: 'root',
};

const mockData = Object.fromEntries(
  [
    componentItem,
    groupItem,
    storyBranchItem,
    orphanDocsItem,
    storyLeafItem,
    testItem,
    docsItem,
  ].map((item) => [item.id, item])
);

const makeMockArgs = <T extends BaseEntry>(
  mockItem: T
): {
  item: T;
  statuses: StatusByTypeId;
} => ({
  item: mockItem,
  statuses: {
    critical: {
      value: 'status-value:error',
      title: 'Critical Issue',
      description: 'Something terrible happened and we cannot recover.',
      storyId: mockItem.id,
      typeId: '???',
      sidebarContextMenu: true,
    },
    a11y: {
      value: 'status-value:success',
      title: 'Accessibility tests',
      description: 'All axe-core tests passed.',
      storyId: mockItem.id,
      typeId: '???',
      sidebarContextMenu: true,
    },
  },
});

const meta = {
  title: 'Sidebar/TreeNode',
  parameters: { layout: 'padded' },
  globals: { sb_theme: 'side-by-side' },
  component: TreeNode,
  decorators: [
    (StoryFn, { args }) => (
      <LayoutProvider>
        <IconSymbols />
        {/* <StoryFn /> */}
        <Tree
          api={args.api}
          data={args.data}
          refId={args.refId}
          isBrowsing
          isDevelopment
          isMain
          docsMode={false}
          selectedStoryId={null}
          onSelectStoryId={args.onSelectStoryId}
        />
      </LayoutProvider>
    ),
  ],
  args: {
    api: {
      getElements: fn(() => []),
      getShortcutKeys: fn(() => ({
        openInEditor: ['alt', 'shift', 'e'],
        contextMenu: ['ctrl', 'shift', 'u'],
      })),
      on: fn(),
      off: fn(),
    } as unknown as API,
    data: mockData,
    refId: DEFAULT_REF_ID,
    docsMode: false,
    isDevelopment: true,
    isOrphan: false,
    isSelected: false,
    onSelectStoryId: fn(),
    isExpanded: false,
    setExpanded: fn(),
  },
} satisfies Meta<typeof TreeNode>;

export default meta;

export const StoryLeaf = {
  args: {
    item: storyLeafItem,
    statuses: {},
  },
};

export const Types: StoryObj<typeof meta> = {
  args: {
    ...makeMockArgs(componentItem),
  },
  render: (args) => (
    <>
      {JSON.stringify(args.api.getShortcutKeys())}
      {/* <TreeNode {...args} item={componentItem}>
        Component
      </TreeNode>
      <TreeNode {...args} item={groupItem}>
        Group
      </TreeNode>
      <TreeNode {...args} item={storyBranchItem}>
        Story (with tests)
      </TreeNode>
      <TreeNode {...args} item={storyLeafItem}>
        Story (leaf node)
      </TreeNode>
      <TreeNode {...args} item={testItem}>
        Test
      </TreeNode>
      <TreeNode {...args} item={docsItem} docsMode={false}>
        Document
      </TreeNode> */}
    </>
  ),
};

export const Expandable = () => (
  <>
    <TreeNode item={componentItem}>Collapsed component</TreeNode>
    <TreeNode item={componentItem} isExpanded>
      Expanded component
    </TreeNode>
    <TreeNode item={groupItem}>Collapsed group</TreeNode>
    <TreeNode item={groupItem} isExpanded>
      Expanded group
    </TreeNode>
  </>
);

export const ExpandableLongName = () => (
  <>
    <TreeNode item={componentItem}>
      Collapsed component with a very very very very very very very very very very very very very
      very very very very very very veryvery very very very very very very very very veryvery very
      very very very very very very very veryvery very very very very very very very very veryvery
      very very very very very very very very veryvery very very very very very very very very
      veryvery very very very very very very very very veryvery very very very very very very very
      very very long name
    </TreeNode>
    <TreeNode item={componentItem} isExpanded>
      Expanded component with a very very very very very very very very very very very very very
      very very very very very very veryvery very very very very very very very very veryvery very
      very very very very very very very veryvery very very very very very very very very veryvery
      very very very very very very very very veryvery very very very very very very very very
      veryvery very very very very very very very very veryvery very very very very very very very
      very very long name
    </TreeNode>
    <TreeNode item={groupItem}>
      Collapsed group with a very very very very very very very very very very very very very very
      very very very very very veryvery very very very very very very very very veryvery very very
      very very very very very very veryvery very very very very very very very very veryvery very
      very very very very very very very veryvery very very very very very very very very veryvery
      very very very very very very very very veryvery very very very very very very very very very
      long name
    </TreeNode>
    <TreeNode item={groupItem} isExpanded>
      Expanded group with a very very very very very very very very very very very very very very
      very very very very very veryvery very very very very very very very very veryvery very very
      very very very very very very veryvery very very very very very very very very veryvery very
      very very very very very very very veryvery very very very very very very very very veryvery
      very very very very very very very very veryvery very very very very very very very very very
      long name
    </TreeNode>
  </>
);

export const Nested = () => (
  <>
    <TreeNode item={docsItem} docsMode={false} level={1}>
      Zero
    </TreeNode>
    <TreeNode item={groupItem} isExpanded level={1}>
      Zero
    </TreeNode>
    <TreeNode item={groupItem} isExpanded level={2}>
      One
    </TreeNode>
    <TreeNode item={storyBranchItem} level={3}>
      Two
    </TreeNode>
    <TreeNode item={testItem} level={4}>
      Three
    </TreeNode>
    <TreeNode item={componentItem} isExpanded level={3}>
      Two
    </TreeNode>
    <TreeNode item={storyBranchItem} level={4}>
      Three
    </TreeNode>
    <TreeNode item={testItem} level={5}>
      Four
    </TreeNode>
  </>
);

export const NestedLongName = () => (
  <>
    <TreeNode item={docsItem} docsMode={false} level={1}>
      A very very very very very very very very very very very very very very very very very very
      very veryvery very very very very very very very very veryvery very very very very very very
      very very veryvery very very very very very very very very veryvery very very very very very
      very very very veryvery very very very very very very very very veryvery very very very very
      very very very very veryvery very very very very very very very very very long name
    </TreeNode>
    <TreeNode item={groupItem} isExpanded level={1}>
      A very very very very very very very very very very very very very very very very very very
      very veryvery very very very very very very very very veryvery very very very very very very
      very very veryvery very very very very very very very very veryvery very very very very very
      very very very veryvery very very very very very very very very veryvery very very very very
      very very very very veryvery very very very very very very very very very long name
    </TreeNode>
    <TreeNode item={groupItem} isExpanded level={2}>
      A very very very very very very very very very very very very very very very very very very
      very veryvery very very very very very very very very veryvery very very very very very very
      very very veryvery very very very very very very very very veryvery very very very very very
      very very very veryvery very very very very very very very very veryvery very very very very
      very very very very veryvery very very very very very very very very very long name
    </TreeNode>
    <TreeNode item={storyBranchItem} level={3}>
      A very very very very very very very very very very very very very very very very very very
      very veryvery very very very very very very very very veryvery very very very very very very
      very very veryvery very very very very very very very very veryvery very very very very very
      very very very veryvery very very very very very very very very veryvery very very very very
      very very very very veryvery very very very very very very very very very long name
    </TreeNode>
    <TreeNode item={testItem} level={4}>
      A very very very very very very very very very very very very very very very very very very
      very veryvery very very very very very very very very veryvery very very very very very very
      very very veryvery very very very very very very very very veryvery very very very very very
      very very very veryvery very very very very very very very very veryvery very very very very
      very very very very veryvery very very very very very very very very very long name
    </TreeNode>
    <TreeNode item={componentItem} isExpandable isExpanded level={3}>
      A very very very very very very very very very very very very very very very very very very
      very veryvery very very very very very very very very veryvery very very very very very very
      very very veryvery very very very very very very very very veryvery very very very very very
      very very very veryvery very very very very very very very very veryvery very very very very
      very very very very veryvery very very very very very very very very very long name
    </TreeNode>
    <TreeNode item={storyBranchItem} level={4}>
      A very very very very very very very very very very very very very very very very very very
      very veryvery very very very very very very very very veryvery very very very very very very
      very very veryvery very very very very very very very very veryvery very very very very very
      very very very veryvery very very very very very very very very veryvery very very very very
      very very very very veryvery very very very very very very very very very long name
    </TreeNode>
    <TreeNode item={testItem} level={5}>
      A very very very very very very very very very very very very very very very very very very
      very veryvery very very very very very very very very veryvery very very very very very very
      very very veryvery very very very very very very very very veryvery very very very very very
      very very very veryvery very very very very very very very very veryvery very very very very
      very very very very veryvery very very very very very very very very very long name
    </TreeNode>
  </>
);

export const Selection = () => (
  <>
    <TreeNode item={storyLeafItem}>Default story</TreeNode>
    <TreeNode item={storyLeafItem} isSelected>
      Selected story
    </TreeNode>
    <TreeNode item={storyLeafItem} isHighlighted>
      Highlighted story
    </TreeNode>
    <TreeNode item={storyLeafItem} isHighlighted isSelected>
      Highlighted + Selected story
    </TreeNode>
    <TreeNode item={testItem}>Default test</TreeNode>
    <TreeNode item={testItem} isSelected>
      Selected test
    </TreeNode>
    <TreeNode item={groupItem}>Default group</TreeNode>
    <TreeNode item={groupItem} isHighlighted>
      Highlighted group
    </TreeNode>
  </>
);

export const SelectionWithLongName = () => (
  <>
    <TreeNode item={storyLeafItem}>
      Default story with a very very very very very very very very very very very very very very
      very very very very very veryvery very very very very very very very very veryvery very very
      very very very very very very veryvery very very very very very very very very veryvery very
      very very very very very very very veryvery very very very very very very very very veryvery
      very very very very very very very very veryvery very very very very very very very very very
      long name
    </TreeNode>
    <TreeNode item={storyLeafItem} isSelected>
      Selected story with a very very very very very very very very very very very very very very
      very very very very very veryvery very very very very very very very very veryvery very very
      very very very very very very veryvery very very very very very very very very veryvery very
      very very very very very very very veryvery very very very very very very very very veryvery
      very very very very very very very very veryvery very very very very very very very very very
      long name
    </TreeNode>
    <TreeNode item={storyLeafItem} isHighlighted>
      Highlighted story with a very very very very very very very very very very very very very very
      very very very very very veryvery very very very very very very very very veryvery very very
      very very very very very very veryvery very very very very very very very very veryvery very
      very very very very very very very veryvery very very very very very very very very veryvery
      very very very very very very very very veryvery very very very very very very very very very
      long name
    </TreeNode>
    <TreeNode item={storyLeafItem} isHighlighted isSelected>
      Highlighted + Selected story with a very very very very very very very very very very very
      very very very very very very very very veryvery very very very very very very very very
      veryvery very very very very very very very veryvery very very very very very very very very
      veryvery very very very very very very very very veryvery very very very very very very very
      veryvery very very very very very very very very veryvery very very very very very very very
      very very long name
    </TreeNode>
    <TreeNode item={groupItem}>
      Default group with a very very very very very very very very very very very very very very
      very very very very very veryvery very very very very very very very very veryvery very very
      very very very very very very veryvery very very very very very very very very veryvery very
      very very very very very very very veryvery very very very very very very very very veryvery
      very very very very very very very very veryvery very very very very very very very very very
      long name
    </TreeNode>
    <TreeNode item={groupItem} isHighlighted>
      Highlighted group with a very very very very very very very very very very very very very very
      very very very very very veryvery very very very very very very very very veryvery very very
      very very very very very very very veryvery very very very very very very very veryvery very
      very very very very very very very veryvery very very very very very very very very veryvery
      very very very very very very very very veryvery very very very very very very very very very
      long name
    </TreeNode>
  </>
);
