import React from 'react';

import { HighlightStyles } from './HighlightStyles';
import { IconSymbols } from './IconSymbols';
import { LeafNodeStyleWrapper } from './Tree';
import {
  ComponentNode,
  DocumentNode,
  GroupNode,
  StoryBranchNode,
  StoryLeafNode,
  TestNode,
} from './TreeNode';

export default {
  title: 'Sidebar/TreeNode',
  parameters: { layout: 'padded' },
  globals: { sb_theme: 'side-by-side' },
  component: StoryLeafNode,
  decorators: [
    (StoryFn: any) => (
      <>
        <IconSymbols />
        <StoryFn />
      </>
    ),
  ],
};

export const Types = () => (
  <>
    <ComponentNode>Component</ComponentNode>
    <GroupNode>Group</GroupNode>
    <StoryBranchNode>Story (with tests)</StoryBranchNode>
    <StoryLeafNode>Story (leaf node)</StoryLeafNode>
    <TestNode>Test</TestNode>
    <DocumentNode docsMode={false}>Document</DocumentNode>
  </>
);

export const Expandable = () => (
  <>
    <ComponentNode isExpandable>Collapsed component</ComponentNode>
    <ComponentNode isExpandable isExpanded>
      Expanded component
    </ComponentNode>
    <GroupNode isExpandable>Collapsed group</GroupNode>
    <GroupNode isExpandable isExpanded>
      Expanded group
    </GroupNode>
  </>
);

export const ExpandableLongName = () => (
  <>
    <ComponentNode isExpandable>
      Collapsed component with a very very very very very very very very very very very very very
      very very very very very very veryvery very very very very very very very very veryvery very
      very very very very very very very veryvery very very very very very very very very veryvery
      very very very very very very very very veryvery very very very very very very very very
      veryvery very very very very very very very very veryvery very very very very very very very
      very very long name
    </ComponentNode>
    <ComponentNode isExpandable isExpanded>
      Expanded component with a very very very very very very very very very very very very very
      very very very very very very veryvery very very very very very very very very veryvery very
      very very very very very very very veryvery very very very very very very very very veryvery
      very very very very very very very very veryvery very very very very very very very very
      veryvery very very very very very very very very veryvery very very very very very very very
      very very long name
    </ComponentNode>
    <GroupNode isExpandable>
      Collapsed group with a very very very very very very very very very very very very very very
      very very very very very veryvery very very very very very very very very veryvery very very
      very very very very very very veryvery very very very very very very very very veryvery very
      very very very very very very very veryvery very very very very very very very very veryvery
      very very very very very very very very veryvery very very very very very very very very very
      long name
    </GroupNode>
    <GroupNode isExpandable isExpanded>
      Expanded group with a very very very very very very very very very very very very very very
      very very very very very veryvery very very very very very very very very veryvery very very
      very very very very very very veryvery very very very very very very very very veryvery very
      very very very very very very very veryvery very very very very very very very very veryvery
      very very very very very very very very veryvery very very very very very very very very very
      long name
    </GroupNode>
  </>
);

export const Nested = () => (
  <>
    <DocumentNode docsMode={false} depth={0}>
      Zero
    </DocumentNode>
    <GroupNode isExpandable isExpanded depth={0}>
      Zero
    </GroupNode>
    <GroupNode isExpandable isExpanded depth={1}>
      One
    </GroupNode>
    <StoryBranchNode depth={2}>Two</StoryBranchNode>
    <TestNode depth={3}>Three</TestNode>
    <ComponentNode isExpandable isExpanded depth={2}>
      Two
    </ComponentNode>
    <StoryBranchNode depth={3}>Three</StoryBranchNode>
    <TestNode depth={4}>Four</TestNode>
  </>
);

export const NestedLongName = () => (
  <>
    <DocumentNode docsMode={false} depth={0}>
      A very very very very very very very very very very very very very very very very very very
      very veryvery very very very very very very very very veryvery very very very very very very
      very very veryvery very very very very very very very very veryvery very very very very very
      very very very veryvery very very very very very very very very veryvery very very very very
      very very very very veryvery very very very very very very very very very long name
    </DocumentNode>
    <GroupNode isExpandable isExpanded depth={0}>
      A very very very very very very very very very very very very very very very very very very
      very veryvery very very very very very very very very veryvery very very very very very very
      very very veryvery very very very very very very very very veryvery very very very very very
      very very very veryvery very very very very very very very very veryvery very very very very
      very very very very veryvery very very very very very very very very very long name
    </GroupNode>
    <GroupNode isExpandable isExpanded depth={1}>
      A very very very very very very very very very very very very very very very very very very
      very veryvery very very very very very very very very veryvery very very very very very very
      very very veryvery very very very very very very very very veryvery very very very very very
      very very very veryvery very very very very very very very very veryvery very very very very
      very very very very veryvery very very very very very very very very very long name
    </GroupNode>
    <StoryBranchNode depth={2}>
      A very very very very very very very very very very very very very very very very very very
      very veryvery very very very very very very very very veryvery very very very very very very
      very very veryvery very very very very very very very very veryvery very very very very very
      very very very veryvery very very very very very very very very veryvery very very very very
      very very very very veryvery very very very very very very very very very long name
    </StoryBranchNode>
    <TestNode depth={3}>
      A very very very very very very very very very very very very very very very very very very
      very veryvery very very very very very very very very veryvery very very very very very very
      very very veryvery very very very very very very very very veryvery very very very very very
      very very very veryvery very very very very very very very very veryvery very very very very
      very very very very veryvery very very very very very very very very very long name
    </TestNode>
    <ComponentNode isExpandable isExpanded depth={2}>
      A very very very very very very very very very very very very very very very very very very
      very veryvery very very very very very very very very veryvery very very very very very very
      very very veryvery very very very very very very very very veryvery very very very very very
      very very very veryvery very very very very very very very very veryvery very very very very
      very very very very veryvery very very very very very very very very very long name
    </ComponentNode>
    <StoryBranchNode depth={3}>
      A very very very very very very very very very very very very very very very very very very
      very veryvery very very very very very very very very veryvery very very very very very very
      very very veryvery very very very very very very very very veryvery very very very very very
      very very very veryvery very very very very very very very very veryvery very very very very
      very very very very veryvery very very very very very very very very very long name
    </StoryBranchNode>
    <TestNode depth={4}>
      A very very very very very very very very very very very very very very very very very very
      very veryvery very very very very very very very very veryvery very very very very very very
      very very veryvery very very very very very very very very veryvery very very very very very
      very very very veryvery very very very very very very very very veryvery very very very very
      very very very very veryvery very very very very very very very very very long name
    </TestNode>
  </>
);

export const Selection = () => (
  <>
    <HighlightStyles refId="foo" itemId="bar" />
    <LeafNodeStyleWrapper
      data-ref-id="baz"
      data-item-id="bar"
      data-nodetype="story"
      data-selected="false"
      className="sidebar-item"
    >
      <StoryLeafNode>Default story</StoryLeafNode>
    </LeafNodeStyleWrapper>
    <LeafNodeStyleWrapper
      data-ref-id="baz"
      data-item-id="bar"
      data-nodetype="story"
      data-selected="true"
      className="sidebar-item"
    >
      <StoryLeafNode>Selected story</StoryLeafNode>
    </LeafNodeStyleWrapper>
    <LeafNodeStyleWrapper
      data-ref-id="foo"
      data-item-id="bar"
      data-nodetype="story"
      data-selected="false"
      className="sidebar-item"
    >
      <StoryLeafNode>Highlighted story</StoryLeafNode>
    </LeafNodeStyleWrapper>
    <LeafNodeStyleWrapper
      data-ref-id="foo"
      data-item-id="bar"
      data-nodetype="story"
      data-selected="true"
      className="sidebar-item"
    >
      <StoryLeafNode>Highlighted + Selected story</StoryLeafNode>
    </LeafNodeStyleWrapper>
    <LeafNodeStyleWrapper
      data-ref-id="baz"
      data-item-id="bar"
      data-nodetype="test"
      data-selected="false"
      className="sidebar-item"
    >
      <TestNode>Default test</TestNode>
    </LeafNodeStyleWrapper>
    <LeafNodeStyleWrapper
      data-ref-id="baz"
      data-item-id="bar"
      data-nodetype="test"
      data-selected="true"
      className="sidebar-item"
    >
      <TestNode>Selected test</TestNode>
    </LeafNodeStyleWrapper>
    <LeafNodeStyleWrapper
      data-ref-id="foo"
      data-item-id="baz"
      data-nodetype="group"
      data-selected="false"
      className="sidebar-item"
    >
      <GroupNode>Default group</GroupNode>
    </LeafNodeStyleWrapper>
    <LeafNodeStyleWrapper
      data-ref-id="foo"
      data-item-id="bar"
      data-nodetype="group"
      data-selected="false"
      className="sidebar-item"
    >
      <GroupNode>Highlighted group</GroupNode>
    </LeafNodeStyleWrapper>
  </>
);

export const SelectionWithLongName = () => (
  <>
    <HighlightStyles refId="foo" itemId="bar" />
    <LeafNodeStyleWrapper
      data-ref-id="baz"
      data-item-id="bar"
      data-nodetype="story"
      data-selected="false"
      className="sidebar-item"
    >
      <StoryLeafNode>
        Default story with a very very very very very very very very very very very very very very
        very very very very very veryvery very very very very very very very very veryvery very very
        very very very very very very veryvery very very very very very very very very veryvery very
        very very very very very very very veryvery very very very very very very very very veryvery
        very very very very very very very very veryvery very very very very very very very very
        very long name
      </StoryLeafNode>
    </LeafNodeStyleWrapper>
    <LeafNodeStyleWrapper
      data-ref-id="baz"
      data-item-id="bar"
      data-nodetype="story"
      data-selected="true"
      className="sidebar-item"
    >
      <StoryLeafNode>
        Selected story with a very very very very very very very very very very very very very very
        very very very very very veryvery very very very very very very very very veryvery very very
        very very very very very very veryvery very very very very very very very very veryvery very
        very very very very very very very veryvery very very very very very very very very veryvery
        very very very very very very very very veryvery very very very very very very very very
        very long name
      </StoryLeafNode>
    </LeafNodeStyleWrapper>
    <LeafNodeStyleWrapper
      data-ref-id="foo"
      data-item-id="bar"
      data-nodetype="story"
      data-selected="false"
      className="sidebar-item"
    >
      <StoryLeafNode>
        Highlighted story with a very very very very very very very very very very very very very
        very very very very very very veryvery very very very very very very very very veryvery very
        very very very very very very very veryvery very very very very very very very very veryvery
        very very very very very very very very veryvery very very very very very very very very
        veryvery very very very very very very very very veryvery very very very very very very very
        very very long name
      </StoryLeafNode>
    </LeafNodeStyleWrapper>
    <LeafNodeStyleWrapper
      data-ref-id="foo"
      data-item-id="bar"
      data-nodetype="story"
      data-selected="true"
      className="sidebar-item"
    >
      <StoryLeafNode>
        Highlighted + Selected story with a very very very very very very very very very very very
        very very very very very very very very veryvery very very very very very very very very
        veryvery very very very very very very very very veryvery very very very very very very very
        very veryvery very very very very very very very very veryvery very very very very very very
        very very veryvery very very very very very very very very veryvery very very very very very
        very very very very long name
      </StoryLeafNode>
    </LeafNodeStyleWrapper>
    <LeafNodeStyleWrapper
      data-ref-id="foo"
      data-item-id="baz"
      data-nodetype="group"
      data-selected="false"
      className="sidebar-item"
    >
      <GroupNode>
        Default group with a very very very very very very very very very very very very very very
        very very very very very veryvery very very very very very very very very veryvery very very
        very very very very very very veryvery very very very very very very very very veryvery very
        very very very very very very very veryvery very very very very very very very very veryvery
        very very very very very very very very veryvery very very very very very very very very
        very long name
      </GroupNode>
    </LeafNodeStyleWrapper>
    <LeafNodeStyleWrapper
      data-ref-id="foo"
      data-item-id="bar"
      data-nodetype="group"
      data-selected="false"
      className="sidebar-item"
    >
      <GroupNode>
        Highlighted group with a very very very very very very very very very very very very very
        very very very very very very veryvery very very very very very very very very veryvery very
        very very very very very very very veryvery very very very very very very very very veryvery
        very very very very very very very very veryvery very very very very very very very very
        veryvery very very very very very very very very veryvery very very very very very very very
        very very long name
      </GroupNode>
    </LeafNodeStyleWrapper>
  </>
);
