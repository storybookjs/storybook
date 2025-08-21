import React, { useCallback, useEffect } from 'react';

import { ToggleIconButton } from 'storybook/internal/components';

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
      label: 'Toggle Measure [M]',
      defaultShortcut: ['M'],
      actionName: 'measure',
      showInMenu: false,
      action: toggleMeasure,
    });
  }, [toggleMeasure, api]);

  return (
    <ToggleIconButton
      key={TOOL_ID}
      pressed={measureEnabled}
      ariaLabel="Measure tool"
      tooltip="Toggle measure"
      description="When enabled, this tool shows dimensions and whitespace (margin, padding, border) for the currently hovered element in the preview area. Does not work with keyboard focus."
      onClick={toggleMeasure}
    >
      <RulerIcon />
    </ToggleIconButton>
  );
};
