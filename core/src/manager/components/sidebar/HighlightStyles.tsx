import type { FC } from 'react';
import React from 'react';

import { Global } from '@storybook/core/theming';

import { transparentize } from 'polished';

import type { Highlight } from './types';

// @ts-expect-error (non strict)
export const HighlightStyles: FC<Highlight> = ({ refId, itemId }) => (
  <Global
    styles={({ color }) => {
      const background = transparentize(0.85, color.secondary);
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
