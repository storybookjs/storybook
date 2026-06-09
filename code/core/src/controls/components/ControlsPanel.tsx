import React, { useEffect, useMemo, useState } from 'react';

import type { ArgTypes } from 'storybook/internal/types';

import { global } from '@storybook/global';

import { dequal as deepEqual } from 'dequal';
import { mergeServiceArgTypes } from '../../docs-tools/argTypes/docgenServiceArgTypes.ts';
import {
  useArgTypes,
  useArgs,
  useGlobals,
  useParameter,
  useServiceQuery,
  useStorybookApi,
  useStorybookState,
} from 'storybook/manager-api';
import type { DocgenService } from 'storybook/open-service';
import { styled } from 'storybook/theming';

import {
  ArgsTable,
  type SortType,
} from '../../../../addons/docs/src/blocks/components/ArgsTable/ArgsTable.tsx';
import type { PresetColor } from '../../../../addons/docs/src/blocks/controls/types.ts';
import { PARAM_KEY } from '../constants.ts';
import { SaveStory } from './SaveStory.tsx';

// Remove undefined values (top-level only)
const clean = (obj: { [key: string]: any }) =>
  Object.entries(obj).reduce(
    (acc, [key, value]) => (value !== undefined ? Object.assign(acc, { [key]: value }) : acc),
    {} as typeof obj
  );

const AddonWrapper = styled.div<{ showSaveFromUI: boolean }>(({ showSaveFromUI, theme }) => ({
  height: '100%',
  maxHeight: '100vh',
  paddingBottom: showSaveFromUI ? 41 : 0,
  backgroundColor: theme.background.content,

  table: {
    backgroundColor: theme.background.app,
  },
}));

interface ControlsParameters {
  sort?: SortType;
  expanded?: boolean;
  presetColors?: PresetColor[];
  disableSaveFromUI?: boolean;
}

interface ControlsPanelProps {
  saveStory: () => Promise<unknown>;
  createStory: (storyName: string) => Promise<unknown>;
  docgenService?: DocgenService;
}

function applyPresetColors(rows: ArgTypes, presetColors: PresetColor[] | undefined) {
  const withPresetColors = Object.entries(rows).reduce((acc, [key, arg]) => {
    const control = arg?.control;

    if (typeof control !== 'object' || control?.type !== 'color' || control?.presetColors) {
      acc[key] = arg;
    } else {
      acc[key] = { ...arg, control: { ...control, presetColors } };
    }
    return acc;
  }, {} as ArgTypes);

  return withPresetColors;
}

function ControlsPanelTable({
  rows,
  isLoading,
  saveStory,
  createStory,
}: ControlsPanelProps & { rows: ArgTypes; isLoading: boolean }) {
  const [args, updateArgs, resetArgs, initialArgs] = useArgs();
  const [globals] = useGlobals();
  const {
    expanded,
    sort,
    presetColors,
    disableSaveFromUI = false,
  } = useParameter<ControlsParameters>(PARAM_KEY, {});
  const { path } = useStorybookState();
  const api = useStorybookApi();
  const storyData = api.getCurrentStoryData();

  const hasControls = Object.values(rows).some((arg) => arg?.control);
  const withPresetColors = applyPresetColors(rows, presetColors);

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
      {showSaveFromUI && <SaveStory {...{ resetArgs, saveStory, createStory }} />}
    </AddonWrapper>
  );
}

function LegacyControlsPanel(props: ControlsPanelProps) {
  const [isLoading, setIsLoading] = useState(true);
  const rows = useArgTypes();
  const { refs, previewInitialized } = useStorybookState();
  const api = useStorybookApi();
  const storyData = api.getCurrentStoryData();

  // Stories from a composed ref track their own `previewInitialized` flag; the host's
  // global flag stays false for them, so read the ref's flag when on a ref story (#34553).
  const isPreviewInitialized = storyData?.refId
    ? !!refs[storyData.refId]?.previewInitialized
    : previewInitialized;

  // If the story is prepared, then show the args table and reset the loading state
  useEffect(() => {
    if (isPreviewInitialized) {
      setIsLoading(false);
    }
  }, [isPreviewInitialized]);

  return <ControlsPanelTable {...props} rows={rows} isLoading={isLoading} />;
}

function ServiceControlsPanel({
  docgenService,
  ...props
}: ControlsPanelProps & { docgenService: DocgenService }) {
  const api = useStorybookApi();
  const storyData = api.getCurrentStoryData();
  const [, , , initialArgs] = useArgs();
  // Custom argTypes (project + meta + story, already inferred) for the selected story arrive over
  // the channel via STORY_PREPARED — the same source the legacy panel reads. The service only needs
  // to contribute server-extracted component props.
  const customArgTypes = useArgTypes();
  const id = storyData.id.split('--')[0];
  const docgenPayload = useServiceQuery(docgenService, 'getDocgen', { id });
  const rows = useMemo(
    () =>
      docgenPayload
        ? mergeServiceArgTypes({
            payload: docgenPayload,
            storyId: storyData.id,
            parameters: storyData.parameters,
            initialArgs,
            customArgTypes,
          })
        : {},
    [docgenPayload, initialArgs, storyData.id, storyData.parameters, customArgTypes]
  );

  return <ControlsPanelTable {...props} rows={rows} isLoading={!docgenPayload} />;
}

export const ControlsPanel = (props: ControlsPanelProps) => {
  if (props.docgenService) {
    return <ServiceControlsPanel {...props} docgenService={props.docgenService} />;
  }

  return <LegacyControlsPanel {...props} />;
};
