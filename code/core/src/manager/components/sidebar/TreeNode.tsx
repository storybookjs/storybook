import type { ComponentProps, FC } from 'react';
import React from 'react';

import { type FunctionInterpolation, type Theme, styled } from 'storybook/theming';

import { UseSymbol } from './IconSymbols';
import { CollapseIcon } from './components/CollapseIcon';

export const TypeIcon = styled.svg<{ type: 'component' | 'story' | 'test' | 'group' | 'document' }>(
  ({ theme, type }) => ({
    width: 14,
    height: 14,
    flex: '0 0 auto',
    color: (() => {
      if (type === 'group') {
        return theme.base === 'dark' ? theme.color.primary : theme.color.ultraviolet;
      }

      if (type === 'component') {
        return theme.color.secondary;
      }

      if (type === 'document') {
        return theme.base === 'dark' ? theme.color.gold : '#ff8300';
      }

      if (type === 'story') {
        return theme.color.seafoam;
      }

      if (type === 'test') {
        return theme.color.green;
      }

      return 'currentColor';
    })(),
  })
);

const commonNodeStyles: FunctionInterpolation<{ depth?: number; isExpandable?: boolean }> = ({
  theme,
  depth = 0,
  isExpandable = false,
}) => ({
  flex: 1,
  width: '100%',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'start',
  textAlign: 'left',
  textDecoration: 'none',
  border: 'none',
  color: 'inherit',
  fontSize: `${theme.typography.size.s2}px`,
  fontWeight: 'inherit',
  background: 'transparent',
  minHeight: 28,
  borderRadius: 4,
  gap: 6,
  paddingLeft: `${(isExpandable ? 8 : 22) + depth * 18}px`,
  paddingTop: 5,
  paddingBottom: 4,
  overflowWrap: 'break-word',
  wordWrap: 'break-word',
  wordBreak: 'break-word',
});

const BranchNode = styled.button<{
  depth?: number;
  isExpandable?: boolean;
  isExpanded?: boolean;
  isSelected?: boolean;
}>(commonNodeStyles);

const LeafNode = styled.a<{ depth?: number }>(commonNodeStyles);

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

  '&:first-of-type': {
    marginTop: 0,
  },
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
  function ComponentNode({
    theme,
    children,
    isExpanded = false,
    isExpandable = false,
    isSelected,
    ...props
  }) {
    return (
      <BranchNode isExpandable={isExpandable} tabIndex={-1} {...props}>
        <Wrapper>
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

export const DocumentNode: FC<ComponentProps<typeof LeafNode> & { docsMode?: boolean }> =
  React.memo(function DocumentNode({ theme, children, docsMode, ...props }) {
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
  });

export const StoryNode: FC<ComponentProps<typeof BranchNode>> = React.memo(function StoryNode({
  theme,
  children,
  isExpandable = false,
  isExpanded = false,
  isSelected,
  ...props
}) {
  return (
    <BranchNode isExpandable={isExpandable} tabIndex={-1} {...props}>
      <Wrapper>
        {isExpandable && <CollapseIcon isExpanded={isExpanded} />}
        <TypeIcon viewBox="0 0 14 14" width="12" height="12" type="story">
          <UseSymbol type="story" />
        </TypeIcon>
      </Wrapper>
      {children}
    </BranchNode>
  );
});

export const TestNode: FC<ComponentProps<typeof LeafNode>> = React.memo(function TestNode({
  theme,
  children,
  ...props
}) {
  return (
    <LeafNode tabIndex={-1} {...props}>
      <Wrapper>
        <TypeIcon viewBox="0 0 14 14" width="12" height="12" type="test">
          <UseSymbol type="test" />
        </TypeIcon>
      </Wrapper>
      {children}
    </LeafNode>
  );
});
