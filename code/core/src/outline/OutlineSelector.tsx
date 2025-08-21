import React, { memo, useCallback, useEffect } from 'react';

import { ToggleIconButton } from 'storybook/internal/components';

import { OutlineIcon } from '@storybook/icons';

import { useGlobals, useStorybookApi } from 'storybook/manager-api';

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
    [isActive, updateGlobals]
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
    <ToggleIconButton
      key="outline"
      pressed={isActive}
      ariaLabel="Outline tool"
      tooltip="Toggle outline"
      description="When enabled, this tool displays the outline of every element in the preview area, which helps understand their layout."
      onClick={toggleOutline}
    >
      <OutlineIcon />
    </ToggleIconButton>
  );
});
