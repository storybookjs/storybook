import React from 'react';

import { styled } from 'storybook/theming';

import { UseSymbol } from '../IconSymbols';

export const TypeIcon = styled.svg<{ type: 'component' | 'story' | 'test' | 'group' | 'docs' }>(
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

      if (type === 'docs') {
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

export const TypeIconWithSymbol = React.memo<{
  type: 'component' | 'story' | 'test' | 'group' | 'docs';
}>(function TypeIconWithSymbol({ type }) {
  return (
    <TypeIcon viewBox="0 0 14 14" width="14" height="14" type={type}>
      <UseSymbol type={type} />
    </TypeIcon>
  );
});
