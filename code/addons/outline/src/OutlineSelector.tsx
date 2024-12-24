import React, { memo, useCallback, useEffect } from 'react';

import { IconButton } from 'storybook/internal/components';
import { useGlobals, useStorybookApi } from 'storybook/internal/manager-api';

import { OutlineIcon } from '@storybook/icons';

import { ADDON_ID, PARAM_KEY } from './constants';

export const OutlineSelector = memo(function OutlineSelector() {
  const [globals, updateGlobals] = useGlobals();
  const api = useStorybookApi();

  const isActive = [true, 'true'].includes(globals[PARAM_KEY]);

  const toggleOutline = useCallback(
    () =>
      updateGlobals({
        [PARAM_KEY]: !isActive,
      }),
    [isActive]
  );

  useEffect(() => {
    api.setAddonShortcut(ADDON_ID, {
      label: 'Toggle Outline',
      defaultShortcut: ['alt', 'O'],
      actionName: 'outline',
      showInMenu: false,
      action: toggleOutline,
    });
  }, [toggleOutline, api]);

  return (
    <IconButton
      key="outline"
      active={isActive}
      title="Apply outlines to the preview"
      onClick={toggleOutline}
    >
      <OutlineIcon />
    </IconButton>
  );
});
