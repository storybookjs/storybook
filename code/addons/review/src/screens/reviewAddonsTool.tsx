import React from 'react';

import { Button } from 'storybook/internal/components';
import type { Addon_BaseType } from 'storybook/internal/types';

import { BottomBarIcon } from '@storybook/icons';

import { types } from 'storybook/manager-api';

import { useReviewPanelContext } from './ReviewPanelContext.tsx';

export const reviewAddonsTool: Addon_BaseType = {
  title: 'addons',
  id: 'review-addons',
  type: types.TOOL,
  match: ({ viewMode, tabId }) => viewMode === 'story' && !tabId,
  render: () => {
    const { isPanelShown, showPanel } = useReviewPanelContext();

    if (isPanelShown) {
      return null;
    }

    return (
      <Button
        padding="small"
        variant="ghost"
        ariaLabel="Show addon panel"
        key="review-addons"
        onClick={() => showPanel(true)}
      >
        <BottomBarIcon />
      </Button>
    );
  },
};
