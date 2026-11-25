import type { Dispatch, SetStateAction } from 'react';
import React, { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  FORCE_REMOUNT,
  PLAY_FUNCTION_THREW_EXCEPTION,
  STORY_RENDER_PHASE_CHANGED,
  STORY_THREW_EXCEPTION,
  UNHANDLED_ERRORS_WHILE_PLAYING,
} from 'storybook/internal/core-events';
import { parsePath } from 'storybook/internal/router';
import type { StatusValue } from 'storybook/internal/types';

import {
  type API,
  experimental_useStatusStore,
  useChannel,
  useParameter,
  useStorybookApi,
  useStorybookState,
} from 'storybook/manager-api';

import {
  STATUS_TYPE_ID_COMPONENT_TEST,
  STORYBOOK_ADDON_TEST_CHANNEL,
} from '../../../../addons/vitest/src/constants.ts';
import { EVENTS } from '../../instrumenter/EVENTS.ts';
import {
  type Call,
  CallStates,
  type LogItem,
  type RenderPhase,
  type SyncPayload,
} from '../../instrumenter/types.ts';
import { INTERNAL_RENDER_CALL_ID } from '../constants.ts';
import { InteractionsPanel } from './InteractionsPanel.tsx';
import type { PlayStatus } from './StatusBadge.tsx';
import {
  INITIAL_CONTROL_STATES,
  INITIAL_PANEL_STATE,
  type Interaction,
  type PanelState,
  panelStore,
  usePanelState,
} from './panelStore.ts';

const playStatusMap: Record<
  Extract<RenderPhase, 'rendering' | 'playing' | 'completed' | 'errored' | 'aborted'>,
  PlayStatus
> = {
  rendering: 'rendering',
  playing: 'playing',
  completed: 'completed',
  errored: 'errored',
  aborted: 'aborted',
};

const terminalStatuses: PlayStatus[] = ['completed', 'errored', 'aborted'];

const storyStatusMap: Record<CallStates, StatusValue> = {
  [CallStates.DONE]: 'status-value:success',
  [CallStates.ERROR]: 'status-value:error',
  [CallStates.ACTIVE]: 'status-value:pending',
  [CallStates.WAITING]: 'status-value:pending',
};

export const getInteractions = ({
  log,
  calls,
  collapsed,
  setCollapsed,
  toggles,
}: {
  log: LogItem[];
  calls: Map<Call['id'], Call>;
  collapsed: Set<Call['id']>;
  setCollapsed: Dispatch<SetStateAction<Set<string>>>;
  toggles?: Map<Call['id'], () => void>;
}): Interaction[] => {
  const callsById = new Map<Call['id'], Call>();
  const childCallMap = new Map<Call['id'], Call['id'][]>();
  const getToggleCollapsed = (id: Call['id']) => {
    const cached = toggles?.get(id);
    if (cached) {
      return cached;
    }
    const toggle = () =>
      setCollapsed((ids) => {
        if (ids.has(id)) {
          ids.delete(id);
        } else {
          ids.add(id);
        }
        return new Set(ids);
      });
    toggles?.set(id, toggle);
    return toggle;
  };

  const interactions = log
    .map(({ callId, ancestors, status }) => {
      let isHidden = false;
      ancestors.forEach((ancestor) => {
        if (collapsed.has(ancestor)) {
          isHidden = true;
        }
        childCallMap.set(ancestor, (childCallMap.get(ancestor) || []).concat(callId));
      });
      return { ...calls.get(callId)!, status, isHidden };
    })
    .map((call) => {
      const status =
        call.status === CallStates.ERROR &&
        call.ancestors &&
        callsById.get(call.ancestors.slice(-1)[0])?.status === CallStates.ACTIVE
          ? CallStates.ACTIVE
          : call.status;
      callsById.set(call.id, { ...call, status });
      return {
        ...call,
        status,
        childCallIds: childCallMap.get(call.id),
        isCollapsed: collapsed.has(call.id),
        toggleCollapsed: getToggleCollapsed(call.id),
      };
    });

  return interactions;
};

/** Drops the cached collapse toggles of the calls that are no longer in the log. */
export const pruneToggles = (toggles: Map<Call['id'], () => void>, log: LogItem[]) => {
  const live = new Set(log.map((item) => item.callId));
  toggles.forEach((_, id) => {
    if (!live.has(id)) {
      toggles.delete(id);
    }
  });
};

export const getPanelState = (
  state: PanelState,
  options: Parameters<typeof getInteractions>[0]
): PanelState =>
  getInteractions(options).reduce(
    (acc, interaction) => {
      if (interaction.id === INTERNAL_RENDER_CALL_ID) {
        acc.interactions.push(interaction);
      } else if (state.status !== 'rendering') {
        acc.controlStates = state.controlStates;
        acc.interactions.push(interaction);
        if (interaction.method !== 'step') {
          acc.interactionsCount++;
        }
      }
      return acc;
    },
    {
      ...state,
      controlStates: INITIAL_CONTROL_STATES,
      interactions: [] as Interaction[],
      interactionsCount: 0,
    }
  );

interface RenderPhaseEvent {
  storyId: string;
  renderId?: number;
  newPhase: RenderPhase;
}

export interface RenderTracker {
  event?: RenderPhaseEvent;
  refId?: string;
  hasRendered?: boolean;
}

export const trackRenderPhase = (
  tracker: RenderTracker,
  event: RenderPhaseEvent,
  currentStoryId: string | undefined,
  refId?: string
): { tracker: RenderTracker; isCurrentRender: boolean; isRerender: boolean } => {
  // A render torn down by a story switch can still report phases after the new story started.
  if (event.storyId !== currentStoryId) {
    return { tracker, isCurrentRender: false, isRerender: false };
  }

  const sameStory = tracker.refId === refId && tracker.event?.storyId === event.storyId;
  const previousRenderId = tracker.event?.renderId;
  // Storybook 9.0 previews send phases without render IDs.
  const isOlderRender =
    previousRenderId !== undefined &&
    event.renderId !== undefined &&
    event.renderId < previousRenderId;
  if (sameStory && (isOlderRender || ['preparing', 'loading'].includes(event.newPhase))) {
    return { tracker, isCurrentRender: false, isRerender: false };
  }

  const hasRendered = sameStory && previousRenderId === event.renderId && !!tracker.hasRendered;
  const isRendering = event.newPhase === 'rendering';

  return {
    tracker: { event, refId, hasRendered: hasRendered || isRendering },
    isCurrentRender: true,
    // A re-render or a remount renders the same story render again, unlike a story switch or HMR.
    isRerender: isRendering && hasRendered,
  };
};

// A re-render does not play again, so it keeps the last play's errors until a new play starts.
export const getRenderPhaseState = (
  state: PanelState,
  phase: RenderPhase,
  isRerender: boolean
): PanelState => {
  if (phase === 'rendering') {
    const { caughtException, unhandledErrors } = isRerender ? state : INITIAL_PANEL_STATE;
    return { ...INITIAL_PANEL_STATE, revision: state.revision, caughtException, unhandledErrors };
  }

  const current =
    phase === 'playing'
      ? { ...state, caughtException: undefined, unhandledErrors: undefined }
      : state;
  const status =
    phase in playStatusMap && !terminalStatuses.includes(current.status)
      ? playStatusMap[phase as keyof typeof playStatusMap]
      : current.status;
  const hasPlayFailed = !!current.caughtException || !!current.unhandledErrors;

  return {
    ...current,
    status: status === 'completed' && hasPlayFailed ? 'errored' : status,
    pausedAt: undefined,
  };
};

const getInternalRenderCall = (storyId: string, exception?: Call['exception']): Call => ({
  id: INTERNAL_RENDER_CALL_ID,
  method: 'render',
  args: [],
  cursor: 0,
  storyId,
  ancestors: [],
  path: [],
  interceptable: true,
  retain: false,
  exception,
});

const getInternalRenderLogItem = (status: CallStates): LogItem => ({
  callId: INTERNAL_RENDER_CALL_ID,
  status,
  ancestors: [],
});

// Module scope: listenForPlayResults updates these while the panel is closed, and starts a new step
// log when a render starts.
let renderTracker: RenderTracker = {};
const log: { current: LogItem[] } = { current: [getInternalRenderLogItem(CallStates.ACTIVE)] };
const calls: { current: Map<Call['id'], Omit<Call, 'status'>> } = {
  current: new Map([[INTERNAL_RENDER_CALL_ID, getInternalRenderCall('')]]),
};

// Registered once with the addon, so render phases and play results reach panelStore while the
// panel is closed.
export const listenForPlayResults = (
  api: Pick<API, 'on'> & { getUrlState: () => { storyId?: string; path: string } }
) => {
  // The router reads the selected ref from the path, as it does for the manager state.
  const getSelection = () => {
    const { storyId, path } = api.getUrlState();
    return { storyId, refId: parsePath(path).refId };
  };
  const isCurrentPlayError = (senderRefId?: string) => {
    const { storyId, refId } = getSelection();
    return (
      senderRefId === refId &&
      renderTracker.refId === refId &&
      renderTracker.event?.newPhase === 'errored' &&
      renderTracker.event.storyId === storyId
    );
  };
  api.on(STORY_RENDER_PHASE_CHANGED, function (this: { refId?: string }, event: RenderPhaseEvent) {
    const { storyId, refId } = getSelection();
    if (this.refId !== refId) {
      return;
    }
    const { tracker, isCurrentRender, isRerender } = trackRenderPhase(
      renderTracker,
      event,
      storyId,
      refId
    );
    renderTracker = tracker;
    if (isCurrentRender) {
      if (event.newPhase === 'rendering') {
        log.current = [getInternalRenderLogItem(CallStates.ACTIVE)];
        // The new log can only reference this story's calls, so drop other stories' records.
        calls.current.forEach((call, id) => {
          if (call.storyId !== event.storyId) {
            calls.current.delete(id);
          }
        });
        calls.current.set(INTERNAL_RENDER_CALL_ID, getInternalRenderCall(event.storyId));
      }
      panelStore.setState((state) => getRenderPhaseState(state, event.newPhase, isRerender));
    }
  });
  api.on(
    PLAY_FUNCTION_THREW_EXCEPTION,
    function (this: { refId?: string }, caughtException: PanelState['caughtException']) {
      if (isCurrentPlayError(this.refId)) {
        panelStore.setState((state) => ({ ...state, caughtException, hasException: true }));
      }
    }
  );
  api.on(
    UNHANDLED_ERRORS_WHILE_PLAYING,
    function (this: { refId?: string }, unhandledErrors: PanelState['unhandledErrors']) {
      if (isCurrentPlayError(this.refId)) {
        panelStore.setState((state) => ({ ...state, unhandledErrors, hasException: true }));
      }
    }
  );
  api.on(FORCE_REMOUNT, ({ storyId }: { storyId: string }) => {
    // A remount keeps the last play's errors until it plays, which a failed render skips.
    if (storyId === api.getUrlState().storyId) {
      panelStore.setState((state) => ({
        ...state,
        caughtException: undefined,
        unhandledErrors: undefined,
      }));
    }
  });
};

export const Panel = memo<{ refId?: string; storyId: string; storyUrl: string }>(
  function PanelMemoized({ refId, storyId, storyUrl }) {
    const { statusValue, testRunId } = experimental_useStatusStore((state) => {
      const storyStatus = refId ? undefined : state[storyId]?.[STATUS_TYPE_ID_COMPONENT_TEST];
      return {
        statusValue: storyStatus?.value,
        testRunId: storyStatus?.data?.testRunId,
      };
    });

    // shared state
    const state = useStorybookState();
    const api = useStorybookApi();
    const data = api.getData(state.storyId, state.refId);
    const importPath = data?.importPath as string | undefined;
    const canOpenInEditor = globalThis.CONFIG_TYPE === 'DEVELOPMENT' && !state.refId;

    const panelState = usePanelState();
    const set = panelStore.setState;

    // local state
    const [scrollTarget, setScrollTarget] = useState<HTMLElement | undefined>(undefined);
    const [collapsed, setCollapsed] = useState<Set<Call['id']>>(new Set());
    const [hasResultMismatch, setResultMismatch] = useState(false);

    const {
      status = 'rendering',
      controlStates = INITIAL_CONTROL_STATES,
      interactions = [],
      pausedAt = undefined,
      caughtException = undefined,
      unhandledErrors = undefined,
    } = panelState;

    const setCall = ({ status, ...call }: Call) => calls.current.set(call.id, call);
    const toggles = useRef(new Map<Call['id'], () => void>()).current;

    const endRef = useRef<HTMLDivElement>();
    useEffect(() => {
      let observer: IntersectionObserver;
      if (globalThis.IntersectionObserver) {
        observer = new globalThis.IntersectionObserver(
          ([end]: any) => setScrollTarget(end.isIntersecting ? undefined : end.target),
          { root: globalThis.document.querySelector('#storybook-panel-root [role="tabpanel"]') }
        );

        if (endRef.current) {
          observer.observe(endRef.current);
        }
      }
      return () => observer?.disconnect();
    }, []);

    const emit = useChannel(
      {
        [EVENTS.CALL]: setCall,
        [EVENTS.SYNC]: (payload: SyncPayload) => {
          if (payload.storyId && payload.storyId !== api.getUrlState().storyId) {
            return;
          }
          log.current = [getInternalRenderLogItem(CallStates.DONE), ...payload.logItems];
          pruneToggles(toggles, log.current);
          set((state) =>
            getPanelState(
              {
                ...state,
                controlStates: payload.controlStates,
                pausedAt: payload.pausedAt,
                revision: state.revision + 1,
              },
              { log: log.current, calls: calls.current, collapsed, setCollapsed, toggles }
            )
          );
        },
        [STORY_THREW_EXCEPTION]: (e: { name: string; message: string; stack: string }) => {
          log.current = [getInternalRenderLogItem(CallStates.ERROR)];
          calls.current.set(
            INTERNAL_RENDER_CALL_ID,
            getInternalRenderCall(storyId, { ...e, callId: INTERNAL_RENDER_CALL_ID })
          );
          set((state) =>
            getPanelState(
              {
                ...state,
                hasException: true,
                caughtException: undefined,
                controlStates: INITIAL_CONTROL_STATES,
                pausedAt: undefined,
              },
              { log: log.current, calls: calls.current, collapsed, setCollapsed, toggles }
            )
          );
        },
      },
      [collapsed, storyId]
    );

    // listenForPlayResults sets the status for each render phase; list the steps for that status.
    useEffect(() => {
      set((state) =>
        getPanelState(state, {
          log: log.current,
          calls: calls.current,
          collapsed,
          setCollapsed,
          toggles,
        })
      );
    }, [set, collapsed, toggles, status]);

    const controls = useMemo(
      () => ({
        start: () => emit(EVENTS.START, { storyId }),
        back: () => emit(EVENTS.BACK, { storyId }),
        goto: (callId: string) => emit(EVENTS.GOTO, { storyId, callId }),
        next: () => emit(EVENTS.NEXT, { storyId }),
        end: () => emit(EVENTS.END, { storyId }),
        rerun: () => {
          emit(FORCE_REMOUNT, { storyId });
        },
      }),
      [emit, storyId]
    );

    const storyFilePath = useParameter('fileName', '');
    const [fileName] = storyFilePath.toString().split('/').slice(-1);
    const scrollToTarget = useCallback(
      () => scrollTarget?.scrollIntoView({ behavior: 'smooth', block: 'end' }),
      [scrollTarget]
    );
    // Stable props keep the memoized panel from re-rendering its whole list on every commit.
    const { detached, start, back, goto, next, end } = controlStates;
    const panelControlStates = useMemo(
      () => ({ detached: !!refId || detached, start, back, goto, next, end }),
      [refId, detached, start, back, goto, next, end]
    );

    const hasException =
      !!caughtException ||
      !!unhandledErrors ||
      interactions.some((v) => v.status === CallStates.ERROR);

    const browserTestStatus = useMemo<CallStates | undefined>(() => {
      if (status !== 'playing' && (interactions.length > 0 || hasException)) {
        return hasException ? CallStates.ERROR : CallStates.DONE;
      }
      return status === 'playing' ? CallStates.ACTIVE : undefined;
    }, [status, interactions, hasException]);

    useEffect(() => {
      const isMismatch =
        browserTestStatus &&
        statusValue &&
        statusValue !== 'status-value:pending' &&
        statusValue !== storyStatusMap[browserTestStatus];

      if (isMismatch) {
        const timeout = setTimeout(
          () =>
            setResultMismatch((currentValue) => {
              if (!currentValue) {
                emit(STORYBOOK_ADDON_TEST_CHANNEL, {
                  type: 'test-discrepancy',
                  payload: {
                    browserStatus: browserTestStatus === CallStates.DONE ? 'PASS' : 'FAIL',
                    cliStatus: browserTestStatus === CallStates.DONE ? 'FAIL' : 'PASS',
                    storyId,
                    testRunId,
                  },
                });
              }
              return true;
            }),
          2000
        );
        return () => clearTimeout(timeout);
      } else {
        setResultMismatch(false);
      }
    }, [emit, browserTestStatus, statusValue, storyId, testRunId]);

    return (
      <Fragment key="component-tests">
        <InteractionsPanel
          storyUrl={storyUrl}
          status={status}
          hasResultMismatch={hasResultMismatch}
          browserTestStatus={browserTestStatus}
          calls={calls.current}
          controls={controls}
          controlStates={panelControlStates}
          interactions={interactions}
          fileName={fileName}
          hasException={hasException}
          caughtException={caughtException}
          unhandledErrors={unhandledErrors}
          pausedAt={pausedAt}
          // @ts-expect-error TODO
          endRef={endRef}
          onScrollToEnd={scrollTarget ? scrollToTarget : undefined}
          importPath={importPath}
          canOpenInEditor={canOpenInEditor}
          api={api}
        />
      </Fragment>
    );
  }
);
