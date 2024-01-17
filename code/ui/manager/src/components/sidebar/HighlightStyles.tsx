import type { FC } from 'react';
import React from 'react';
import { Global } from '@storybook/theming';
import type { Highlight } from './types';

export const HighlightStyles: FC<Highlight> = ({ refId, itemId }) => (
  <Global
    styles={({ color }) => {
      const background = 'var(--sb-sidebar-itemHoverBackground)';
      return {
        [`[data-ref-id="${refId}"][data-item-id="${itemId}"]:not([data-selected="true"])`]: {
          [`&[data-nodetype="component"], &[data-nodetype="group"]`]: {
            background,
            '&:hover, &:focus': { background },
          },
          [`&[data-nodetype="story"], &[data-nodetype="document"]`]: {
            color: color.defaultText,
            background,
            '&:hover, &:focus': { background },
          },
        },
      };
    }}
  />
);
