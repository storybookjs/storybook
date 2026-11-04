import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import type { ArgTypes, DocgenPayload } from 'storybook/internal/types';

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
import { styled } from 'storybook/theming/emotion';

import {
  ArgsTable,
  type SortType,
} from '../../../../addons/docs/src/blocks/components/ArgsTable/ArgsTable.tsx';
import type { PresetColor } from '../../../../addons/docs/src/blocks/controls/types.ts';
import { PARAM_KEY } from '../constants.ts';
import type { DocgenGate } from '../docgenGate.ts';
import { SaveStory } from './SaveStory.tsx';

// Remove undefined values (top-level only)
const clean = (obj: { [key: string]: any }) =>
  Object.entries(obj).reduce(
    (acc, [key, value]) => (value !== undefined ? Object.assign(acc, { [key]: value }) : acc),
    {} as typeof obj
  );

// True when at least one row carries an interactive control, i.e. the args table renders rows instead
// of its "No controls" empty state. Used to decide between showing controls and the loading skeleton
// while docgen for the story is still pending, so the empty state never flashes before docgen lands.
const hasAnyControl = (rows: ArgTypes) => Object.values(rows).some((arg) => arg?.control);

const AddonWrapper = styled.div<{ showSaveFromUI: boolean }>(({ showSaveFromUI, theme }) => ({
  // `minHeight` (not `height`) so the wrapper fills a short panel but grows with tall
  // content; otherwise a fixed height clips the bottom padding into the middle of the
  // scrolled content and the save bar overlaps the last control (#34531).
  minHeight: '100%',
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

interface ControlsPanelActions {
  saveStory: () => Promise<unknown>;
  createStory: (storyName: string) => Promise<unknown>;
}

interface ControlsPanelProps extends ControlsPanelActions {
  docgenService?: DocgenService;
  docgenGate: DocgenGate;
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
}: ControlsPanelActions & { rows: ArgTypes; isLoading: boolean }) {
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

  const hasControls = hasAnyControl(rows);
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

function LegacyControlsPanel(props: ControlsPanelActions) {
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

// Mounted only once the docgen gate opens, because subscribing starts the load. It reports upward so the
// table below keeps its position, and its control state, when the gate opens.
function DocgenQuery({
  docgenService,
  id,
  onChange,
}: {
  docgenService: DocgenService;
  id: string;
  onChange: (state: { payload?: DocgenPayload; isInitialLoading: boolean }) => void;
}) {
  const { data, isInitialLoading } = useServiceQuery(docgenService.queries.docgen, { id });
  useEffect(() => {
    onChange({ payload: data, isInitialLoading });
  }, [data, isInitialLoading, onChange]);
  return null;
}

function ServiceControlsPanel({
  docgenService,
  docgenGate,
  ...props
}: ControlsPanelProps & { docgenService: DocgenService }) {
  const api = useStorybookApi();
  const storyData = api.getCurrentStoryData();
  const [, , , initialArgs] = useArgs();
  // Custom argTypes (project + meta + story annotations) for the selected story arrive over the
  // channel via STORY_PREPARED. With docgenServer, prepareStory skips second-pass
  // enhancers so these stay annotation-only; mergeServiceArgTypes layers them on server docgen.
  const customArgTypes = useArgTypes();
  const id = storyData.id.split('--')[0];
  const isStory = storyData.type === 'story';
  // In a static build docgen is precomputed and there is no gate, so the loading decision must not
  // hang on `prepared` — treat non-development as always prepared. In dev this is unchanged.
  const isDevelopment = global.CONFIG_TYPE === 'DEVELOPMENT';
  const isStoryPrepared = !isDevelopment || (isStory ? storyData.prepared : true);
  // Docs entries don't emit the story lifecycle events the gate listens for, so it only applies to
  // actual stories; everything else queries docgen right away.
  const renderReady = useSyncExternalStore(docgenGate.subscribe, () =>
    docgenGate.isReady(storyData.id, storyData.refId)
  );
  const gateReady = !isDevelopment || renderReady;
  const queryReady = !isStory || gateReady;

  const [docgen, setDocgen] = useState<{
    id: string;
    payload?: DocgenPayload;
    isInitialLoading: boolean;
  }>();
  const onDocgenChange = useCallback(
    (state: { payload?: DocgenPayload; isInitialLoading: boolean }) => setDocgen({ id, ...state }),
    [id]
  );
  const current = queryReady && docgen?.id === id ? docgen : undefined;
  const docgenPayload = current?.payload;

  // The manager Controls panel only ever shows the main component's rows; subcomponent tabs are a
  // docs-blocks-only feature, so this intentionally ignores `payload.subcomponents` to match the
  // legacy panel's behavior.
  const docgenResolved = !!current && !current.isInitialLoading;
  const rows = useMemo(
    () =>
      docgenResolved
        ? mergeServiceArgTypes({
            payload: docgenPayload,
            storyId: storyData.id,
            parameters: storyData.parameters,
            initialArgs,
            customArgTypes,
          })
        : customArgTypes,
    [docgenResolved, docgenPayload, initialArgs, storyData.id, storyData.parameters, customArgTypes]
  );

  // Keep the skeleton up only while there is genuinely nothing to show: the story isn't prepared, or
  // docgen hasn't resolved yet and there are no annotation controls to fall back on. Once docgen
  // resolves (even to nothing) the table or its "No controls" empty state is the real answer.
  const isDocgenLoading = !docgenResolved;

  return (
    <>
      {queryReady && (
        <DocgenQuery docgenService={docgenService} id={id} onChange={onDocgenChange} />
      )}
      <ControlsPanelTable
        {...props}
        rows={rows}
        isLoading={!isStoryPrepared || (isDocgenLoading && !hasAnyControl(rows))}
      />
    </>
  );
}

export const ControlsPanel = ({ docgenService, ...props }: ControlsPanelProps) => {
  if (docgenService) {
    return <ServiceControlsPanel {...props} docgenService={docgenService} />;
  }

  return <LegacyControlsPanel {...props} />;
};
