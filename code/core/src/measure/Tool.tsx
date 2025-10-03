import React, { useCallback, useEffect } from 'react';

import { IconButton } from 'storybook/internal/components';

import { RulerIcon } from '@storybook/icons';

import { useGlobals, useStorybookApi } from 'storybook/manager-api';

import { ADDON_ID, TOOL_ID } from './constants';

export const Tool = () => {
  const [globals, updateGlobals] = useGlobals();
  const { measureEnabled } = globals || {};
  const api = useStorybookApi();

  const toggleMeasure = useCallback(
    () =>
      updateGlobals({
        measureEnabled: !measureEnabled,
      }),
    [updateGlobals, measureEnabled]
  );

  useEffect(() => {
    api.setAddonShortcut(ADDON_ID, {
      label: 'Toggle Measure',
      defaultShortcut: ['M'],
      actionName: 'measure',
      showInMenu: false,
      action: toggleMeasure,
    });
  }, [toggleMeasure, api]);

  return (
    <IconButton
      key={TOOL_ID}
      active={measureEnabled}
      title="Enable measure"
      onClick={toggleMeasure}
    >
      <RulerIcon />
    </IconButton>
  );
};
