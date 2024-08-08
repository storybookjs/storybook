import type { FC } from 'react';
import React, { memo } from 'react';

import { useGlobals, useParameter } from 'storybook/internal/manager-api';
import { IconButton } from 'storybook/internal/components';

import { GridIcon } from '@storybook/icons';
import { PARAM_KEY as BACKGROUNDS_PARAM_KEY } from '../constants';

export const GridToolLegacy: FC = memo(function GridSelector() {
  const [globals, updateGlobals] = useGlobals();

  const { grid } = useParameter(BACKGROUNDS_PARAM_KEY, {
    grid: { disable: false },
  });

  if (grid?.disable) {
    return null;
  }

  const isActive = globals[BACKGROUNDS_PARAM_KEY]?.grid || false;

  return (
    <IconButton
      key="background"
      active={isActive}
      title="Apply a grid to the preview"
      onClick={() =>
        updateGlobals({
          [BACKGROUNDS_PARAM_KEY]: { ...globals[BACKGROUNDS_PARAM_KEY], grid: !isActive },
        })
      }
    >
      <GridIcon />
    </IconButton>
  );
});
