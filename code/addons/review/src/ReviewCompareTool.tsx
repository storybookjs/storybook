import React, { type FC } from 'react';

import { ActionList, IconButton, PopoverProvider } from 'storybook/internal/components';
import type { Addon_BaseType } from 'storybook/internal/types';

import { SideBySideIcon, StopAltHollowIcon, TransferIcon } from '@storybook/icons';

import { types } from 'storybook/manager-api';

import type { CompareMode } from './constants.ts';
import { useReview } from './review-store.ts';

const modeIcon = (mode: CompareMode) => {
  switch (mode) {
    case 'split':
      return <SideBySideIcon />;
    case 'baseline':
      return <TransferIcon />;
    default:
      return <StopAltHollowIcon />;
  }
};

const modeLabel = (mode: CompareMode) => {
  switch (mode) {
    case 'split':
      return 'Split';
    case 'baseline':
      return 'Baseline';
    default:
      return 'Latest';
  }
};

const CompareMenu: FC = () => {
  const { compareMode, setCompareMode, showCompare } = useReview();

  if (!showCompare) {
    return null;
  }

  const modes: CompareMode[] = ['latest', 'baseline', 'split'];

  return (
    <PopoverProvider
      padding="none"
      popover={
        <ActionList>
          {modes.map((mode) => (
            <ActionList.Item key={mode}>
              <ActionList.Button
                aria-selected={compareMode === mode}
                onClick={() => setCompareMode(mode)}
              >
                {modeLabel(mode)}
              </ActionList.Button>
            </ActionList.Item>
          ))}
        </ActionList>
      }
    >
      <IconButton
        variant="ghost"
        size="small"
        padding="small"
        ariaLabel={`Compare mode: ${modeLabel(compareMode)}`}
      >
        {modeIcon(compareMode)}
      </IconButton>
    </PopoverProvider>
  );
};

export const reviewCompareTool: Addon_BaseType = {
  id: 'storybook/addon-review/compare',
  type: types.TOOLEXTRA,
  title: 'Compare baseline',
  match: ({ viewMode }) => viewMode === 'story',
  render: () => <CompareMenu />,
};
