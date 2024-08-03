import { dequal as deepEqual } from 'dequal';
import React, { useEffect, useMemo, useState } from 'react';
import { global } from '@storybook/global';
import {
  useArgs,
  useGlobals,
  useArgTypes,
  useParameter,
  useStorybookState,
} from 'storybook/internal/manager-api';
import { PureArgsTable as ArgsTable, type PresetColor, type SortType } from '@storybook/blocks';
import { styled } from 'storybook/internal/theming';
import type { ArgTypes } from 'storybook/internal/types';

import { PARAM_KEY } from './constants';
import { SaveStory } from './SaveStory';

// Remove undefined values (top-level only)
const clean = (obj: { [key: string]: any }) =>
  Object.entries(obj).reduce(
    (acc, [key, value]) => (value !== undefined ? Object.assign(acc, { [key]: value }) : acc),
    {} as typeof obj
  );

const AddonWrapper = styled.div({
  display: 'grid',
  gridTemplateRows: '1fr 39px',
  height: '100%',
  maxHeight: '100vh',
  overflowY: 'auto',
});

interface ControlsParameters {
  sort?: SortType;
  expanded?: boolean;
  presetColors?: PresetColor[];
  disableSaveFromUI?: boolean;
}

interface ControlsPanelProps {
  saveStory: () => Promise<unknown>;
  createStory: (storyName: string) => Promise<unknown>;
}

export const ControlsPanel = ({ saveStory, createStory }: ControlsPanelProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [args, updateArgs, resetArgs, initialArgs] = useArgs();
  const [globals] = useGlobals();
  const rows = useArgTypes();
  const {
    expanded,
    sort,
    presetColors,
    disableSaveFromUI = false,
  } = useParameter<ControlsParameters>(PARAM_KEY, {});
  const { path, previewInitialized } = useStorybookState();

  // If the story is prepared, then show the args table
  // and reset the loading states
  useEffect(() => {
    if (previewInitialized) setIsLoading(false);
  }, [previewInitialized]);

  const hasControls = Object.values(rows).some((arg) => arg?.control);

  const withPresetColors = Object.entries(rows).reduce((acc, [key, arg]) => {
    const control = arg?.control;
    if (typeof control !== 'object' || control?.type !== 'color' || control?.presetColors)
      acc[key] = arg;
    else acc[key] = { ...arg, control: { ...control, presetColors } };
    return acc;
  }, {} as ArgTypes);

  const hasUpdatedArgs = useMemo(
    () => !!args && !!initialArgs && !deepEqual(clean(args), clean(initialArgs)),
    [args, initialArgs]
  );

  return (
    <AddonWrapper>
      <ArgsTable
        key={path} // resets state when switching stories
        compact={!expanded && hasControls}
        rows={withPresetColors}
        args={args}
        globals={globals}
        updateArgs={updateArgs}
        resetArgs={resetArgs}
        inAddonPanel
        sort={sort}
        isLoading={isLoading}
      />
      {hasControls &&
        hasUpdatedArgs &&
        global.CONFIG_TYPE === 'DEVELOPMENT' &&
        disableSaveFromUI !== true && <SaveStory {...{ resetArgs, saveStory, createStory }} />}
    </AddonWrapper>
  );
};
