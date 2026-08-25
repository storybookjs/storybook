import React, { useEffect, useMemo, useState } from 'react';

import { STORY_FINISHED, STORY_PREPARED } from 'storybook/internal/core-events';
import type { ArgTypes, StoryId } from 'storybook/internal/types';

import { global } from '@storybook/global';

import { dequal as deepEqual } from 'dequal';
import { mergeServiceArgTypes } from '../../docs-tools/argTypes/docgenServiceArgTypes.ts';
import {
  useArgTypes,
  useArgs,
  useChannel,
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

function LoadedServiceControlsPanel({
  customArgTypes,
  docgenService,
  id,
  initialArgs,
  isStoryPrepared,
  storyData,
  ...props
}: ControlsPanelProps & {
  customArgTypes: ArgTypes;
  docgenService: DocgenService;
  id: string;
  initialArgs: ReturnType<typeof useArgs>[3];
  isStoryPrepared: boolean;
  storyData: ReturnType<ReturnType<typeof useStorybookApi>['getCurrentStoryData']>;
}) {
  const { data: docgenPayload, isInitialLoading } = useServiceQuery(docgenService.queries.docgen, {
    id,
  });

  // The manager Controls panel only ever shows the main component's rows; subcomponent tabs are a
  // docs-blocks-only feature, so this intentionally ignores `payload.subcomponents` to match the
  // legacy panel's behavior.
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
        : customArgTypes,
    [docgenPayload, initialArgs, storyData.id, storyData.parameters, customArgTypes]
  );

  // Keep the skeleton up only while there is genuinely nothing to show: the story isn't prepared, or
  // docgen is still doing its first load and there are no annotation controls to fall back on. Once
  // docgen resolves (even to nothing) the table or its "No controls" empty state is the real answer —
  // never a flash. While docgen loads over already-available annotation controls, show those controls
  // rather than skeletoning over them.
  return (
    <ControlsPanelTable
      {...props}
      rows={rows}
      isLoading={!isStoryPrepared || (isInitialLoading && !hasAnyControl(rows))}
    />
  );
}

// Tracks whether it is safe to query docgen for the selected story, gating the CPU-bound worker
// extraction out of the first-render window so it never starves the dev server's bundling or the
// preview's render/paint. The gate resets on every story change.
//
// In a static build there is no bundling to contend with and docgen is precomputed JSON, so the gate
// is open from the start. In dev it opens once the story reaches a safe point in its lifecycle:
// STORY_FINISHED by default, or — with the STORYBOOK_DOCGEN_STORY_PREPARED env var — the earlier
// STORY_PREPARED (the story module has been delivered to the browser, before it mounts and paints),
// trading a slice of the first-render budget for an earlier Controls population. The server reads the
// env var and injects it into the manager as the DOCGEN_STORY_PREPARED global so it can be evaluated
// per project.
function useStoryDocgenGateReady(storyId: StoryId): boolean {
  const isDevelopment = global.CONFIG_TYPE === 'DEVELOPMENT';
  const requestAtStoryPrepared = global.DOCGEN_STORY_PREPARED === true;
  // Key readiness by the story it was opened for (derived during render, not via an effect). On a
  // story switch this is immediately false for the new id, so we never render one frame with a stale
  // `ready=true` that would mount the query before the new story emits its gate event.
  const [readyStoryId, setReadyStoryId] = useState<StoryId | null>(null);
  const ready = !isDevelopment || readyStoryId === storyId;

  // STORY_PREPARED carries `{ id }`; STORY_FINISHED carries `{ storyId }`.
  const gateEvent = requestAtStoryPrepared ? STORY_PREPARED : STORY_FINISHED;
  useChannel(
    {
      [gateEvent]: (payload: { id?: StoryId; storyId?: StoryId }) => {
        const eventStoryId = requestAtStoryPrepared ? payload?.id : payload?.storyId;
        if (eventStoryId === storyId) {
          setReadyStoryId(storyId);
        }
      },
    },
    [storyId, requestAtStoryPrepared, gateEvent]
  );

  return ready;
}

function ServiceControlsPanel({
  docgenService,
  ...props
}: ControlsPanelProps & { docgenService: DocgenService }) {
  const api = useStorybookApi();
  const storyData = api.getCurrentStoryData();
  const [, , , initialArgs] = useArgs();
  // Custom argTypes (project + meta + story annotations) for the selected story arrive over the
  // channel via STORY_PREPARED. With experimentalDocgenServer, prepareStory skips second-pass
  // enhancers so these stay annotation-only; mergeServiceArgTypes layers them on server docgen.
  const customArgTypes = useArgTypes();
  const id = storyData.id.split('--')[0];
  const isStory = storyData.type === 'story';
  // In a static build docgen is precomputed and there is no gate, so the loading decision must not
  // hang on `prepared` — treat non-development as always prepared. In dev this is unchanged.
  const isDevelopment = global.CONFIG_TYPE === 'DEVELOPMENT';
  const isStoryPrepared = !isDevelopment || (isStory ? storyData.prepared : true);
  // Docs entries don't emit the story lifecycle events the gate listens for, so it only applies to
  // actual stories; everything else falls through and queries docgen right away.
  const gateReady = useStoryDocgenGateReady(storyData.id);
  if (isStory && !gateReady) {
    // Docgen hasn't been queried yet (the query is gated until the story reaches a safe lifecycle
    // point). Show the story's own annotation argTypes when it has controls; otherwise keep the
    // loading skeleton rather than flashing the "No controls" empty state before docgen resolves.
    return (
      <ControlsPanelTable
        {...props}
        rows={customArgTypes}
        isLoading={!isStoryPrepared || !hasAnyControl(customArgTypes)}
      />
    );
  }

  return (
    <LoadedServiceControlsPanel
      {...props}
      customArgTypes={customArgTypes}
      docgenService={docgenService}
      id={id}
      initialArgs={initialArgs}
      isStoryPrepared={isStoryPrepared}
      storyData={storyData}
    />
  );
}

export const ControlsPanel = ({ docgenService, ...props }: ControlsPanelProps) => {
  if (docgenService) {
    return <ServiceControlsPanel {...props} docgenService={docgenService} />;
  }

  return <LegacyControlsPanel {...props} />;
};
