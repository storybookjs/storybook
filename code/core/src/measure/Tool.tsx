import React, { useCallback, useEffect } from 'react';

import { ToggleButton } from 'storybook/internal/components';

import { RulerIcon } from '@storybook/icons';

import { useGlobals, useParameter, useStorybookApi } from 'storybook/manager-api';

import { ADDON_ID, TOOL_ID } from './constants.ts';
import type { MeasureParameters } from './types.ts';

export const Tool = () => {
  const isDisabled = useParameter<MeasureParameters['measure']>('measure')?.disable;
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
    if (isDisabled) {
      return;
    }
    api.setAddonShortcut(ADDON_ID, {
      label: 'Toggle Measure',
      defaultShortcut: ['M'],
      actionName: 'measure',
      showInMenu: false,
      action: toggleMeasure,
    });
  }, [toggleMeasure, api, isDisabled]);

  if (isDisabled) {
    return null;
  }

  return (
    <ToggleButton
      key={TOOL_ID}
      pressed={measureEnabled}
      padding="small"
      variant="ghost"
      ariaLabel="Measure tool"
      tooltip="Toggle measure"
      ariaDescription="When enabled, this tool shows dimensions and whitespace (margin, padding, border) for the currently hovered element in the preview area. Does not work with keyboard focus."
      onClick={toggleMeasure}
    >
      <RulerIcon />
    </ToggleButton>
  );
};
