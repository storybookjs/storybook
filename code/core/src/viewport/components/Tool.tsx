import React from 'react';

import { ToggleButton } from 'storybook/internal/components';

import { GrowIcon } from '@storybook/icons';

import { useViewport } from '../useViewport';

export const ViewportTool = () => {
  const { isDefault, isLocked, options, lastSelectedOption, reset, select } = useViewport();

  return (
    <ToggleButton
      padding="small"
      variant="ghost"
      key="viewport"
      pressed={!isDefault || isLocked}
      disabled={isLocked}
      ariaLabel={isLocked ? 'Viewport size set by story parameters' : 'Viewport'}
      tooltip={isLocked ? 'Viewport size set by story parameters' : 'Change viewport'}
      onClick={() => (isDefault ? select(lastSelectedOption || Object.keys(options)[0]) : reset())}
    >
      <GrowIcon />
    </ToggleButton>
  );
};
