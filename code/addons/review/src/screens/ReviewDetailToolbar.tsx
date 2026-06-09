import React, { type FC } from 'react';

import { useTabsState } from 'storybook/internal/components';

import type { TabListState } from '@react-stately/tabs';
import { useStorybookApi, useStorybookState } from 'storybook/manager-api';

import { ToolbarComp } from '../../../../core/src/manager/components/preview/Toolbar.tsx';
import { useReviewToolbar } from './useReviewToolbar.ts';

interface ReviewDetailToolbarProps {
  storyId: string;
}

export const ReviewDetailToolbar: FC<ReviewDetailToolbarProps> = ({ storyId }) => {
  const api = useStorybookApi();
  const state = useStorybookState();
  const { tools, toolsExtra, showToolbar } = useReviewToolbar(storyId, api, state);
  const customisedShowToolbar = api.getShowToolbarWithCustomisations(showToolbar);

  const tabState = useTabsState({
    onSelectionChange: () => {},
    tabs: [],
  });

  return (
    <ToolbarComp
      isShown={customisedShowToolbar}
      tools={tools}
      toolsExtra={toolsExtra}
      tabs={[]}
      tabState={tabState as TabListState<object>}
    />
  );
};
