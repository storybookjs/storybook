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
} from 'storybook/manager-api';

import {
  STATUS_TYPE_ID_COMPONENT_TEST,
  STORYBOOK_ADDON_TEST_CHANNEL,
} from '../../../../addons/test/src/constants';
import { EVENTS } from '../../instrumenter/EVENTS';
import { type Call, CallStates, type LogItem } from '../../instrumenter/types';
import { ADDON_ID, INTERNAL_RENDER_CALL_ID } from '../constants';
import { InteractionsPanel } from './InteractionsPanel';

const INITIAL_CONTROL_STATES = {
  start: false,
  back: false,
  goto: false,
  next: false,
  end: false,
};

const statusMap: Record<CallStates, StatusValue> = {
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

export const Panel = memo<{ storyId: string }>(function PanelMemoized({ storyId }) {
  const { statusValue, testRunId } = experimental_useStatusStore((state) => {
    const storyStatus = state[storyId]?.[STATUS_TYPE_ID_COMPONENT_TEST];
    return {
      statusValue: storyStatus?.value,
      testRunId: storyStatus?.data?.testRunId,
    };
  });

  // shared state
  const [addonState, set] = useAddonState(ADDON_ID, {
    controlStates: INITIAL_CONTROL_STATES,
    isErrored: false,
    pausedAt: undefined,
    interactions: [],
    isPlaying: false,
    hasException: false,
    caughtException: undefined,
    interactionsCount: 0,
    unhandledErrors: undefined,
  });

  // local state
  const [scrollTarget, setScrollTarget] = useState<HTMLElement | undefined>(undefined);
  const [collapsed, setCollapsed] = useState<Set<Call['id']>>(new Set());
  const [hasResultMismatch, setResultMismatch] = useState(false);

  const {
    controlStates = INITIAL_CONTROL_STATES,
    isErrored = false,
    pausedAt = undefined,
    interactions = [],
    isPlaying = false,
    caughtException = undefined,
    unhandledErrors = undefined,
  } = addonState;

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
        { root: global.document.querySelector('#panel-tab-content') }
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
      [EVENTS.SYNC]: (payload) => {
        log.current = [getInternalRenderLogItem(CallStates.DONE), ...payload.logItems];
        set((s) => {
          const interactionsList = getInteractions({
            log: log.current,
            calls: calls.current,
            collapsed,
            setCollapsed,
          });
          const interactionsCount = interactionsList.filter(
            ({ id, method }) => id !== INTERNAL_RENDER_CALL_ID && method !== 'step'
          ).length;
          return {
            ...s,
            controlStates: payload.controlStates,
            pausedAt: payload.pausedAt,
            interactions: interactionsList,
            interactionsCount,
          } as typeof s;
        });
      },
      [STORY_RENDER_PHASE_CHANGED]: (event) => {
        if (event.newPhase === 'preparing') {
          log.current = [getInternalRenderLogItem(CallStates.ACTIVE)];
          calls.current.set(INTERNAL_RENDER_CALL_ID, getInternalRenderCall(storyId));
          set({
            controlStates: INITIAL_CONTROL_STATES,
            isErrored: false,
            pausedAt: undefined,
            interactions: [],
            isPlaying: false,
            hasException: false,
            caughtException: undefined,
            interactionsCount: 0,
            unhandledErrors: undefined,
          });
        } else {
          const interactionsList = getInteractions({
            log: log.current,
            calls: calls.current,
            collapsed,
            setCollapsed,
          });
          const interactionsCount = interactionsList.filter(
            ({ id, method }) => id !== INTERNAL_RENDER_CALL_ID && method !== 'step'
          ).length;
          set(
            (s) =>
              ({
                ...s,
                interactions: interactionsList,
                interactionsCount,
                isPlaying: event.newPhase === 'playing',
                pausedAt: undefined,
              }) as typeof s
          );
        }
      },
      [STORY_THREW_EXCEPTION]: (e: { name: string; message: string; stack: string }) => {
        log.current = [getInternalRenderLogItem(CallStates.ERROR)];
        calls.current.set(
          INTERNAL_RENDER_CALL_ID,
          getInternalRenderCall(storyId, { ...e, callId: INTERNAL_RENDER_CALL_ID })
        );
        const interactionsList = getInteractions({
          log: log.current,
          calls: calls.current,
          collapsed,
          setCollapsed,
        });
        set(
          (s) =>
            ({
              ...s,
              isErrored: true,
              hasException: true,
              caughtException: undefined,
              controlStates: INITIAL_CONTROL_STATES,
              pausedAt: undefined,
              interactions: interactionsList,
              interactionsCount: 0,
            }) as typeof s
        );
      },
      [PLAY_FUNCTION_THREW_EXCEPTION]: (e) => {
        set((s) => ({ ...s, caughtException: e, hasException: true }));
      },
      [UNHANDLED_ERRORS_WHILE_PLAYING]: (e) => {
        set((s) => ({ ...s, unhandledErrors: e, hasException: true }));
      },
    },
    [collapsed]
  );

  useEffect(() => {
    // @ts-expect-error TODO
    set((s) => {
      const interactionsList = getInteractions({
        log: log.current,
        calls: calls.current,
        collapsed,
        setCollapsed,
      });
      const interactionsCount = interactionsList.filter(
        ({ id, method }) => id !== INTERNAL_RENDER_CALL_ID && method !== 'step'
      ).length;
      return { ...s, interactions: interactionsList, interactionsCount };
    });
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
    // @ts-expect-error TODO
    interactions.some((v) => v.status === CallStates.ERROR);

  const browserTestStatus = useMemo<CallStates | undefined>(() => {
    if (!isPlaying && (interactions.length > 0 || hasException)) {
      return hasException ? CallStates.ERROR : CallStates.DONE;
    }
    return isPlaying ? CallStates.ACTIVE : undefined;
  }, [isPlaying, interactions, hasException]);

  useEffect(() => {
    const isMismatch =
      browserTestStatus &&
      statusValue &&
      statusValue !== 'status-value:pending' &&
      statusValue !== statusMap[browserTestStatus];

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
        hasResultMismatch={hasResultMismatch}
        browserTestStatus={browserTestStatus}
        calls={calls.current}
        controls={controls}
        controlStates={controlStates}
        interactions={interactions}
        fileName={fileName}
        hasException={hasException}
        caughtException={caughtException}
        unhandledErrors={unhandledErrors}
        isErrored={isErrored}
        isPlaying={isPlaying}
        pausedAt={pausedAt}
        // @ts-expect-error TODO
        endRef={endRef}
        onScrollToEnd={scrollTarget && scrollToTarget}
      />
    </Fragment>
  );
});
