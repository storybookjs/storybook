import type { Dispatch, SetStateAction } from 'react';
import React, { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { FORCE_REMOUNT, STORY_THREW_EXCEPTION } from 'storybook/internal/core-events';
import type { StatusValue } from 'storybook/internal/types';

import {
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
import { type Call, CallStates, type LogItem, type SyncPayload } from '../../instrumenter/types.ts';
import { INTERNAL_RENDER_CALL_ID } from '../constants.ts';
import { InteractionsPanel } from './InteractionsPanel.tsx';
import {
  INITIAL_CONTROL_STATES,
  type Interaction,
  type PanelState,
  panelStore,
  usePanelState,
} from './panelStore.ts';
import {
  getCalls,
  getInternalRenderCall,
  getInternalRenderLogItem,
  getLog,
  recordCall,
  setLog,
} from './renderLifecycle.ts';

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
        [EVENTS.CALL]: recordCall,
        [EVENTS.SYNC]: (payload: SyncPayload) => {
          if (payload.storyId && payload.storyId !== api.getUrlState().storyId) {
            return;
          }
          const log = [getInternalRenderLogItem(CallStates.DONE), ...payload.logItems];
          setLog(log);
          pruneToggles(toggles, log);
          set((state) =>
            getPanelState(
              {
                ...state,
                controlStates: payload.controlStates,
                pausedAt: payload.pausedAt,
                revision: state.revision + 1,
              },
              { log, calls: getCalls(), collapsed, setCollapsed, toggles }
            )
          );
        },
        [STORY_THREW_EXCEPTION]: (e: { name: string; message: string; stack: string }) => {
          const log = [getInternalRenderLogItem(CallStates.ERROR)];
          setLog(log);
          recordCall(getInternalRenderCall(storyId, { ...e, callId: INTERNAL_RENDER_CALL_ID }));
          set((state) =>
            getPanelState(
              {
                ...state,
                hasException: true,
                caughtException: undefined,
                unhandledErrors: undefined,
                controlStates: INITIAL_CONTROL_STATES,
                pausedAt: undefined,
              },
              { log, calls: getCalls(), collapsed, setCollapsed, toggles }
            )
          );
        },
      },
      [collapsed, storyId]
    );

    // listenForRenderLifecycle sets the status of each render phase; list the steps for it.
    useEffect(() => {
      set((state) =>
        getPanelState(state, {
          log: getLog(),
          calls: getCalls(),
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
          calls={getCalls()}
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
