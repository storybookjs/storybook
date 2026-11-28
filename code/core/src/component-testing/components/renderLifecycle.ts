import {
  FORCE_REMOUNT,
  PLAY_FUNCTION_THREW_EXCEPTION,
  STORY_RENDER_PHASE_CHANGED,
  UNHANDLED_ERRORS_WHILE_PLAYING,
} from 'storybook/internal/core-events';
import { parsePath } from 'storybook/internal/router';

import type { API } from 'storybook/manager-api';

import { type Call, CallStates, type LogItem, type RenderPhase } from '../../instrumenter/types.ts';
import { INTERNAL_RENDER_CALL_ID } from '../constants.ts';
import type { PlayStatus } from './StatusBadge.tsx';
import { INITIAL_PANEL_STATE, type PanelState, panelStore } from './panelStore.ts';

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
    return {
      ...INITIAL_PANEL_STATE,
      revision: state.revision,
      caughtException,
      unhandledErrors,
      hasException: !!caughtException || !!unhandledErrors,
    };
  }

  const current =
    phase === 'playing'
      ? { ...state, caughtException: undefined, unhandledErrors: undefined, hasException: false }
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

export const getInternalRenderCall = (storyId: string, exception?: Call['exception']): Call => ({
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

export const getInternalRenderLogItem = (status: CallStates): LogItem => ({
  callId: INTERNAL_RENDER_CALL_ID,
  status,
  ancestors: [],
});

// Module scope, so the listener keeps them current while the panel is closed.
let renderTracker: RenderTracker;
let log: LogItem[];
const calls = new Map<Call['id'], Omit<Call, 'status'>>();

export const resetRenderLifecycle = () => {
  renderTracker = {};
  log = [getInternalRenderLogItem(CallStates.ACTIVE)];
  calls.clear();
  calls.set(INTERNAL_RENDER_CALL_ID, getInternalRenderCall(''));
};
resetRenderLifecycle();

export const getLog = () => log;

export const setLog = (items: LogItem[]) => {
  log = items;
};

export const getCalls = () => calls;

export const recordCall = ({ status, ...call }: Call) => {
  calls.set(call.id, call);
};

// Registered once with the addon, so render phases and play results reach panelStore while the
// panel is closed.
export const listenForRenderLifecycle = (
  api: Pick<API, 'on'> & { getUrlState: () => { storyId?: string; path: string } }
) => {
  // The router reads the selected ref from the path, as it does for the manager state.
  const getSelection = () => {
    const { storyId, path } = api.getUrlState();
    return { storyId, refId: parsePath(path).refId };
  };
  // Play errors carry no story or render ID, and StoryRender sends them right after `errored`.
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
        log = [getInternalRenderLogItem(CallStates.ACTIVE)];
        // The new log can only reference this story's calls and retained calls, which the
        // instrumenter brings back without resending them.
        calls.forEach((call, id) => {
          if (call.storyId !== event.storyId && !call.retain) {
            calls.delete(id);
          }
        });
        calls.set(INTERNAL_RENDER_CALL_ID, getInternalRenderCall(event.storyId));
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
        hasException: false,
      }));
    }
  });
};
