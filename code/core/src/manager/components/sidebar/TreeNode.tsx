import type { ComponentProps, FC } from 'react';
import React from 'react';

import { styled } from '@storybook/core/theming';

import { transparentize } from 'polished';

import { UseSymbol } from './IconSymbols';
import { CollapseIcon } from './components/CollapseIcon';

export const TypeIcon = styled.svg<{ type: 'component' | 'story' | 'group' | 'document' }>(
  ({ theme, type }) => ({
    width: 14,
    height: 14,
    flex: '0 0 auto',
    color: (() => {
      if (type === 'group')
        return theme.base === 'dark' ? theme.color.primary : theme.color.ultraviolet;
      if (type === 'component') return theme.color.secondary;
      if (type === 'document') return theme.base === 'dark' ? theme.color.gold : '#ff8300';
      if (type === 'story') return theme.color.seafoam;
      return 'currentColor';
    })(),
  })
);

const BranchNode = styled.button<{
  depth?: number;
  isExpandable?: boolean;
  isExpanded?: boolean;
  isComponent?: boolean;
  isSelected?: boolean;
}>(({ theme, depth = 0, isExpandable = false }) => ({
  width: '100%',
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'start',
  textAlign: 'left',
  paddingLeft: `${(isExpandable ? 8 : 22) + depth * 18}px`,
  color: 'inherit',
  fontSize: `${theme.typography.size.s2}px`,
  background: 'transparent',
  minHeight: 28,
  borderRadius: 4,
  gap: 6,
  paddingTop: 5,
  paddingBottom: 4,
}));

const LeafNode = styled.a<{ depth?: number }>(({ theme, depth = 0 }) => ({
  width: '100%',
  cursor: 'pointer',
  color: 'inherit',
  display: 'flex',
  gap: 6,
  flex: 1,
  alignItems: 'start',
  paddingLeft: `${22 + depth * 18}px`,
  paddingTop: 5,
  paddingBottom: 4,
  fontSize: `${theme.typography.size.s2}px`,
  textDecoration: 'none',
  overflowWrap: 'break-word',
  wordWrap: 'break-word',
  wordBreak: 'break-word',
}));

export const RootNode = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginTop: 16,
  marginBottom: 4,
  fontSize: `${theme.typography.size.s1 - 1}px`,
  fontWeight: theme.typography.weight.bold,
  lineHeight: '16px',
  minHeight: 28,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: theme.textMutedColor,
}));

const Wrapper = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  marginTop: 2,
});

export const GroupNode: FC<
  ComponentProps<typeof BranchNode> & { isExpanded?: boolean; isExpandable?: boolean }
> = React.memo(function GroupNode({
  children,
  isExpanded = false,
  isExpandable = false,
  ...props
}) {
  return (
    <BranchNode isExpandable={isExpandable} tabIndex={-1} {...props}>
      <Wrapper>
        {isExpandable && <CollapseIcon isExpanded={isExpanded} />}
        <TypeIcon viewBox="0 0 14 14" width="14" height="14" type="group">
          <UseSymbol type="group" />
        </TypeIcon>
      </Wrapper>
      {children}
    </BranchNode>
  );
});

export const ComponentNode: FC<ComponentProps<typeof BranchNode>> = React.memo(
  function ComponentNode({ theme, children, isExpanded, isExpandable, isSelected, ...props }) {
    return (
      <BranchNode isExpandable={isExpandable} tabIndex={-1} {...props}>
        <Wrapper>
          {/* @ts-expect-error (non strict) */}
          {isExpandable && <CollapseIcon isExpanded={isExpanded} />}
          <TypeIcon viewBox="0 0 14 14" width="12" height="12" type="component">
            <UseSymbol type="component" />
          </TypeIcon>
        </Wrapper>
        {children}
      </BranchNode>
    );
  }
);

export const DocumentNode: FC<ComponentProps<typeof LeafNode> & { docsMode: boolean }> = React.memo(
  function DocumentNode({ theme, children, docsMode, ...props }) {
    return (
      <LeafNode tabIndex={-1} {...props}>
        <Wrapper>
          <TypeIcon viewBox="0 0 14 14" width="12" height="12" type="document">
            <UseSymbol type="document" />
          </TypeIcon>
        </Wrapper>
        {children}
      </LeafNode>
    );
  }
);

export const StoryNode: FC<ComponentProps<typeof LeafNode>> = React.memo(function StoryNode({
  theme,
  children,
  ...props
}) {
  return (
    <LeafNode tabIndex={-1} {...props}>
      <Wrapper>
        <TypeIcon viewBox="0 0 14 14" width="12" height="12" type="story">
          <UseSymbol type="story" />
        </TypeIcon>
      </Wrapper>
      {children}
    </LeafNode>
  );
});
