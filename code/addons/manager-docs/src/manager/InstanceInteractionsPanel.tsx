import React, { useEffect, useMemo, useRef, useState } from 'react';

import { useStorybookApi } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import {
  type Controls,
  InteractionsPanel,
} from '../../../../core/src/component-testing/components/InteractionsPanel.tsx';
import { getPanelState } from '../../../../core/src/component-testing/components/Panel.tsx';
import { EVENTS } from '../../../../core/src/instrumenter/EVENTS.ts';
import { type Call, CallStates } from '../../../../core/src/instrumenter/types.ts';
import type { InstanceInteractions } from '../runtime/instance-interactions.ts';

const Body = styled.div({
  minWidth: 0,
  height: '100%',
  overflow: 'auto',
});

export type DebuggerControl = (type: string, payload?: Record<string, unknown>) => void;

/**
 * Show the stock Interactions panel for one story instance, fed only by that instance's events.
 */
export function InstanceInteractionsPanel({
  storyId,
  label,
  state,
  onDebugger,
  onRerun,
}: {
  storyId: string;
  label: string;
  state: InstanceInteractions;
  onDebugger: DebuggerControl;
  onRerun: () => void;
}) {
  const api = useStorybookApi();
  const rootRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [scrollTarget, setScrollTarget] = useState<HTMLElement | undefined>(undefined);
  const [collapsed, setCollapsed] = useState<Set<Call['id']>>(new Set());

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || !endRef.current) {
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([end]) => setScrollTarget(end.isIntersecting ? undefined : (end.target as HTMLElement)),
      { root: rootRef.current }
    );
    observer.observe(endRef.current);
    return () => observer.disconnect();
  }, []);

  const panel = useMemo(
    () =>
      getPanelState(
        {
          status: state.status,
          controlStates: state.controlStates,
          interactions: [],
          interactionsCount: 0,
          hasException: false,
          pausedAt: state.pausedAt,
        },
        { log: state.log, calls: state.calls, collapsed, setCollapsed }
      ),
    [state, collapsed]
  );

  const controls = useMemo<Controls>(
    () => ({
      start: () => onDebugger(EVENTS.START),
      back: () => onDebugger(EVENTS.BACK),
      goto: (callId: string) => onDebugger(EVENTS.GOTO, { callId }),
      next: () => onDebugger(EVENTS.NEXT),
      end: () => onDebugger(EVENTS.END),
      rerun: onRerun,
    }),
    [onDebugger, onRerun]
  );

  const importPath = api.getData(storyId)?.importPath as string | undefined;
  const hasException =
    !!state.caughtException ||
    !!state.unhandledErrors ||
    panel.interactions.some((call) => call.status === CallStates.ERROR);

  return (
    <Body ref={rootRef} aria-label={label}>
      <InteractionsPanel
        storyUrl={`${location.origin}${location.pathname}?path=/story/${storyId}`}
        status={panel.status}
        calls={state.calls}
        controls={controls}
        controlStates={panel.controlStates}
        interactions={panel.interactions}
        fileName={importPath?.split('/').pop()}
        hasException={hasException}
        caughtException={state.caughtException as Error | undefined}
        unhandledErrors={state.unhandledErrors}
        pausedAt={panel.pausedAt}
        endRef={endRef}
        onScrollToEnd={
          scrollTarget && (() => scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'end' }))
        }
        importPath={importPath}
        canOpenInEditor={(globalThis as { CONFIG_TYPE?: string }).CONFIG_TYPE === 'DEVELOPMENT'}
        api={api}
      />
    </Body>
  );
}
