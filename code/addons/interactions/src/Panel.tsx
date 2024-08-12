import type { Dispatch, SetStateAction } from 'react';
import React, { Fragment, memo, useEffect, useMemo, useRef, useState } from 'react';

import {
  FORCE_REMOUNT,
  PLAY_FUNCTION_THREW_EXCEPTION,
  STORY_RENDER_PHASE_CHANGED,
  STORY_THREW_EXCEPTION,
  UNHANDLED_ERRORS_WHILE_PLAYING,
} from 'storybook/internal/core-events';
import { useAddonState, useChannel, useParameter } from 'storybook/internal/manager-api';

import { global } from '@storybook/global';
import { type Call, CallStates, EVENTS, type LogItem } from '@storybook/instrumenter';

import { InteractionsPanel } from './components/InteractionsPanel';
import { ADDON_ID } from './constants';

interface Interaction extends Call {
  status: Call['status'];
  childCallIds: Call['id'][];
  isHidden: boolean;
  isCollapsed: boolean;
  toggleCollapsed: () => void;
}

const INITIAL_CONTROL_STATES = {
  start: false,
  back: false,
  goto: false,
  next: false,
  end: false,
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

  return log
    .map<Call & { isHidden: boolean }>(({ callId, ancestors, status }) => {
      let isHidden = false;
      ancestors.forEach((ancestor) => {
        if (collapsed.has(ancestor)) {
          isHidden = true;
        }
        childCallMap.set(ancestor, (childCallMap.get(ancestor) || []).concat(callId));
      });
      return { ...calls.get(callId), status, isHidden };
    })
    .map<Interaction>((call) => {
      const status =
        call.status === CallStates.ERROR &&
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
};

export const Panel = memo<{ storyId: string }>(function PanelMemoized({ storyId }) {
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
  const log = useRef<LogItem[]>([]);
  const calls = useRef<Map<Call['id'], Omit<Call, 'status'>>>(new Map());
  const setCall = ({ status, ...call }: Call) => calls.current.set(call.id, call);

  const endRef = useRef();
  useEffect(() => {
    let observer: IntersectionObserver;
    if (global.IntersectionObserver) {
      observer = new global.IntersectionObserver(
        ([end]: any) => setScrollTarget(end.isIntersecting ? undefined : end.target),
        { root: global.document.querySelector('#panel-tab-content') }
      );
      if (endRef.current) observer.observe(endRef.current);
    }
    return () => observer?.disconnect();
  }, []);

  const emit = useChannel(
    {
      [EVENTS.CALL]: setCall,
      [EVENTS.SYNC]: (payload) => {
        set((s) => {
          const list = getInteractions({
            log: payload.logItems,
            calls: calls.current,
            collapsed,
            setCollapsed,
          });
          return {
            ...s,
            controlStates: payload.controlStates,
            pausedAt: payload.pausedAt,
            interactions: list,
            interactionsCount: list.filter(({ method }) => method !== 'step').length,
          };
        });

        log.current = payload.logItems;
      },
      [STORY_RENDER_PHASE_CHANGED]: (event) => {
        if (event.newPhase === 'preparing') {
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
          return;
        }
        set((s) => {
          const newState: typeof s = {
            ...s,
            isPlaying: event.newPhase === 'playing',
            pausedAt: undefined,
            ...(event.newPhase === 'rendering'
              ? {
                  isErrored: false,
                  caughtException: undefined,
                }
              : {}),
          };

          return newState;
        });
      },
      [STORY_THREW_EXCEPTION]: () => {
        set((s) => ({ ...s, isErrored: true, hasException: true }));
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
    set((s) => {
      const list = getInteractions({
        log: log.current,
        calls: calls.current,
        collapsed,
        setCollapsed,
      });
      return {
        ...s,
        interactions: list,
        interactionsCount: list.filter(({ method }) => method !== 'step').length,
      };
    });
  }, [collapsed]);

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
    [storyId]
  );

  const storyFilePath = useParameter('fileName', '');
  const [fileName] = storyFilePath.toString().split('/').slice(-1);
  const scrollToTarget = () => scrollTarget?.scrollIntoView({ behavior: 'smooth', block: 'end' });

  const hasException =
    !!caughtException ||
    !!unhandledErrors ||
    interactions.some((v) => v.status === CallStates.ERROR);

  if (isErrored) {
    return <Fragment key="interactions" />;
  }

  return (
    <Fragment key="interactions">
      <InteractionsPanel
        calls={calls.current}
        controls={controls}
        controlStates={controlStates}
        interactions={interactions}
        fileName={fileName}
        hasException={hasException}
        caughtException={caughtException}
        unhandledErrors={unhandledErrors}
        isPlaying={isPlaying}
        pausedAt={pausedAt}
        endRef={endRef}
        onScrollToEnd={scrollTarget && scrollToTarget}
      />
    </Fragment>
  );
});
