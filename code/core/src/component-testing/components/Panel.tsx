import type { Dispatch, SetStateAction } from 'react';
import React, { Fragment, memo, useEffect, useMemo, useRef, useState } from 'react';

import {
  FORCE_REMOUNT,
  PLAY_FUNCTION_THREW_EXCEPTION,
  STORY_RENDER_PHASE_CHANGED,
  STORY_THREW_EXCEPTION,
  UNHANDLED_ERRORS_WHILE_PLAYING,
} from 'storybook/internal/core-events';
import type { StatusValue } from 'storybook/internal/types';

import { global } from '@storybook/global';

import {
  experimental_useStatusStore,
  useAddonState,
  useChannel,
  useParameter,
  useStorybookApi,
  useStorybookState,
} from 'storybook/manager-api';

import {
  STATUS_TYPE_ID_COMPONENT_TEST,
  STORYBOOK_ADDON_TEST_CHANNEL,
} from '../../../../addons/vitest/src/constants';
import { EVENTS } from '../../instrumenter/EVENTS';
import {
  type Call,
  CallStates,
  type ControlStates,
  type LogItem,
  type RenderPhase,
} from '../../instrumenter/types';
import { ADDON_ID, INTERNAL_RENDER_CALL_ID } from '../constants';
import { InteractionsPanel, type SerializedError } from './InteractionsPanel';
import type { PlayStatus } from './StatusBadge';

export interface PanelState {
  status: PlayStatus;
  controlStates: ControlStates;
  interactions: ReturnType<typeof getInteractions>;
  interactionsCount: number;
  hasException: boolean;
  pausedAt?: Call['id'];
  caughtException?: Error;
  unhandledErrors?: SerializedError[];
}

const INITIAL_CONTROL_STATES = {
  detached: false,
  start: false,
  back: false,
  goto: false,
  next: false,
  end: false,
};

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
}: {
  log: LogItem[];
  calls: Map<Call['id'], Call>;
  collapsed: Set<Call['id']>;
  setCollapsed: Dispatch<SetStateAction<Set<string>>>;
}) => {
  const callsById = new Map<Call['id'], Call>();
  const childCallMap = new Map<Call['id'], Call['id'][]>();

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
        toggleCollapsed: () =>
          setCollapsed((ids) => {
            if (ids.has(call.id)) {
              ids.delete(call.id);
            } else {
              ids.add(call.id);
            }
            return new Set(ids);
          }),
      };
    });

  return interactions;
};

export const getPanelState = (
  state: PanelState,
  {
    log,
    calls,
    collapsed,
    setCollapsed,
  }: {
    log: LogItem[];
    calls: Map<Call['id'], Call>;
    collapsed: Set<Call['id']>;
    setCollapsed: Dispatch<SetStateAction<Set<string>>>;
  }
): PanelState =>
  getInteractions({ log, calls, collapsed, setCollapsed }).reduce(
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
      interactions: [] as ReturnType<typeof getInteractions>,
      interactionsCount: 0,
    }
  );

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
    const canOpenInEditor = global.CONFIG_TYPE === 'DEVELOPMENT' && !state.refId;

    const [panelState, set] = useAddonState<PanelState>(ADDON_ID, {
      status: 'rendering' as PlayStatus,
      controlStates: INITIAL_CONTROL_STATES,
      interactions: [] as ReturnType<typeof getInteractions>,
      interactionsCount: 0,
      hasException: false,
      pausedAt: undefined,
      caughtException: undefined,
      unhandledErrors: undefined,
    });

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

    // Log and calls are tracked in a ref so we don't needlessly rerender.
    const log = useRef<LogItem[]>([getInternalRenderLogItem(CallStates.ACTIVE)]);
    const calls = useRef<Map<Call['id'], Omit<Call, 'status'>>>(
      new Map([[INTERNAL_RENDER_CALL_ID, getInternalRenderCall(storyId)]])
    );
    const setCall = ({ status, ...call }: Call) => calls.current.set(call.id, call);

    const endRef = useRef<HTMLDivElement>();
    useEffect(() => {
      let observer: IntersectionObserver;
      if (global.IntersectionObserver) {
        observer = new global.IntersectionObserver(
          ([end]: any) => setScrollTarget(end.isIntersecting ? undefined : end.target),
          { root: global.document.querySelector('#storybook-panel-root [role="tabpanel"]') }
        );

        if (endRef.current) {
          observer.observe(endRef.current);
        }
      }
      return () => observer?.disconnect();
    }, []);

    const lastStoryId = useRef<string>(undefined);
    const lastRenderId = useRef<number>(0);
    const emit = useChannel(
      {
        [EVENTS.CALL]: setCall,
        [EVENTS.SYNC]: (payload) => {
          log.current = [getInternalRenderLogItem(CallStates.DONE), ...payload.logItems];
          set((state) =>
            getPanelState(
              { ...state, controlStates: payload.controlStates, pausedAt: payload.pausedAt },
              { log: log.current, calls: calls.current, collapsed, setCollapsed }
            )
          );
        },
        [STORY_RENDER_PHASE_CHANGED]: (event) => {
          if (
            lastStoryId.current === event.storyId &&
            ['preparing', 'loading'].includes(event.newPhase)
          ) {
            // A rerender cycle may not actually make it to the rendering phase.
            // We don't want to update any state until it does.
            return;
          }

          // Update lastRenderId. When we switch stories, this value might decrease if our
          // users have mocked Date.now() via addons or manually in their code, so we must
          // reset lastRenderId.
          if (lastStoryId.current === event.storyId) {
            lastRenderId.current = Math.max(lastRenderId.current, event.renderId || 0);
          } else {
            lastRenderId.current = event.renderId || 0;
          }

          lastStoryId.current = event.storyId;
          if (lastRenderId.current !== event.renderId) {
            return;
          }

          if (event.newPhase === 'rendering') {
            log.current = [getInternalRenderLogItem(CallStates.ACTIVE)];
            calls.current.set(INTERNAL_RENDER_CALL_ID, getInternalRenderCall(storyId));
            set({
              status: 'rendering',
              controlStates: INITIAL_CONTROL_STATES,
              pausedAt: undefined,
              interactions: [],
              interactionsCount: 0,
              hasException: false,
              caughtException: undefined,
              unhandledErrors: undefined,
            });
          } else {
            set((state) => {
              const status =
                event.newPhase in playStatusMap && !terminalStatuses.includes(state.status)
                  ? playStatusMap[event.newPhase as keyof typeof playStatusMap]
                  : state.status;
              return getPanelState(
                { ...state, status, pausedAt: undefined },
                { log: log.current, calls: calls.current, collapsed, setCollapsed }
              );
            });
          }
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
              { log: log.current, calls: calls.current, collapsed, setCollapsed }
            )
          );
        },
        [PLAY_FUNCTION_THREW_EXCEPTION]: (caughtException) => {
          set((state) => ({ ...state, caughtException, hasException: true }));
        },
        [UNHANDLED_ERRORS_WHILE_PLAYING]: (unhandledErrors) => {
          set((state) => ({ ...state, unhandledErrors, hasException: true }));
        },
      },
      [collapsed]
    );

    useEffect(() => {
      set((state) =>
        getPanelState(state, { log: log.current, calls: calls.current, collapsed, setCollapsed })
      );
    }, [set, collapsed]);

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
    const scrollToTarget = () => scrollTarget?.scrollIntoView({ behavior: 'smooth', block: 'end' });

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
          controlStates={{ ...controlStates, detached: !!refId || controlStates.detached }}
          interactions={interactions}
          fileName={fileName}
          hasException={hasException}
          caughtException={caughtException}
          unhandledErrors={unhandledErrors}
          pausedAt={pausedAt}
          // @ts-expect-error TODO
          endRef={endRef}
          onScrollToEnd={scrollTarget && scrollToTarget}
          importPath={importPath}
          canOpenInEditor={canOpenInEditor}
          api={api}
        />
      </Fragment>
    );
  }
);
