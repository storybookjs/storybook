import React, { useEffect, useMemo, useState } from 'react';

import { ScrollArea } from 'storybook/internal/components';
import type { ArgTypes } from 'storybook/internal/types';

import { global } from '@storybook/global';

import { dequal as deepEqual } from 'dequal';
import {
  useArgTypes,
  useArgs,
  useGlobals,
  useParameter,
  useStorybookApi,
  useStorybookState,
} from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import {
  ArgsTable,
  type SortCustom,
  type SortType,
} from '../../../../addons/docs/src/blocks/components/ArgsTable/ArgsTable';
import type { PresetColor } from '../../../../addons/docs/src/blocks/controls/types';
import { PARAM_KEY } from '../constants';
import { SaveStory } from './SaveStory';

// Remove undefined values (top-level only)
const clean = (obj: { [key: string]: any }) =>
  Object.entries(obj).reduce(
    (acc, [key, value]) => (value !== undefined ? Object.assign(acc, { [key]: value }) : acc),
    {} as typeof obj
  );

const AddonWrapper = styled.div<{ showSaveFromUI: boolean }>(({ showSaveFromUI }) => ({
  display: 'grid',
  gridTemplateRows: showSaveFromUI ? '1fr 41px' : '1fr',
  height: '100%',
  maxHeight: '100vh',
}));

interface ControlsParameters {
  sort?: SortType | SortCustom;
  expanded?: boolean;
  presetColors?: PresetColor[];
  disableSaveFromUI?: boolean;
}

interface ControlsPanelProps {
  saveStory: () => Promise<unknown>;
  createStory: (storyName: string) => Promise<unknown>;
}

export const ControlsPanel = ({ saveStory, createStory }: ControlsPanelProps) => {
  const api = useStorybookApi();
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
  const storyData = api.getCurrentStoryData();

  // If the story is prepared, then show the args table
  // and reset the loading states
  useEffect(() => {
    if (previewInitialized) {
      setIsLoading(false);
    }
  }, [previewInitialized]);

  const hasControls = Object.values(rows).some((arg) => arg?.control);

  const withPresetColors = Object.entries(rows).reduce((acc, [key, arg]) => {
    const control = arg?.control;

    if (typeof control !== 'object' || control?.type !== 'color' || control?.presetColors) {
      acc[key] = arg;
    } else {
      acc[key] = { ...arg, control: { ...control, presetColors } };
    }
    return acc;
  }, {} as ArgTypes);

  const hasUpdatedArgs = useMemo(
    () => !!args && !!initialArgs && !deepEqual(clean(args), clean(initialArgs)),
    [args, initialArgs]
  );

  const showSaveFromUI =
    hasControls &&
    storyData.type === 'story' &&
    storyData.subtype !== 'test' &&
    hasUpdatedArgs &&
    global.CONFIG_TYPE === 'DEVELOPMENT' &&
    disableSaveFromUI !== true;

  return (
    <AddonWrapper showSaveFromUI={showSaveFromUI}>
      <ScrollArea vertical>
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
      </ScrollArea>
      {showSaveFromUI && <SaveStory {...{ resetArgs, saveStory, createStory }} />}
    </AddonWrapper>
  );
};
