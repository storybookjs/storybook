import type { FC } from 'react';
import React from 'react';

import { transparentize } from 'polished';
import { Global } from 'storybook/theming';

import type { Highlight } from './types';

// @ts-expect-error (non strict)
export const HighlightStyles: FC<Highlight> = ({ refId, itemId }) => (
  <Global
    styles={({ color, highlightOpacity }) => {
      const background = transparentize(highlightOpacity ?? 0.85, color.secondary);
      return {
        [`[data-ref-id="${refId}"][data-item-id="${itemId}"]:not([data-selected="true"])`]: {
          [`&[data-nodetype="component"], &[data-nodetype="group"]`]: {
            background,
            '&:hover, &:focus': { background },
          },
          [`&[data-nodetype="story"], &[data-nodetype="document"], &[data-nodetype="test"]`]: {
            color: color.defaultText,
            background,
            '&:hover, &:focus': { background },
          },
        },
      };
    }}
  />
);
