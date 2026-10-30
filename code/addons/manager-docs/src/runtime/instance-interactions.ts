import {
  PLAY_FUNCTION_THREW_EXCEPTION,
  STORY_RENDER_PHASE_CHANGED,
  STORY_THREW_EXCEPTION,
  UNHANDLED_ERRORS_WHILE_PLAYING,
} from 'storybook/internal/core-events';

import type { SerializedError } from '../../../../core/src/component-testing/components/InteractionsPanel.tsx';
import {
  getInternalRenderCall,
  getInternalRenderLogItem,
  INITIAL_CONTROL_STATES,
  type RenderTracker,
  trackRenderPhase,
} from '../../../../core/src/component-testing/components/Panel.tsx';
import type { PlayStatus } from '../../../../core/src/component-testing/components/StatusBadge.tsx';
import { INTERNAL_RENDER_CALL_ID } from '../../../../core/src/component-testing/constants.ts';
import { EVENTS } from '../../../../core/src/instrumenter/EVENTS.ts';
import {
  type Call,
  CallStates,
  type ControlStates,
  type LogItem,
  type RenderPhase,
  type SyncPayload,
} from '../../../../core/src/instrumenter/types.ts';
import type { ChannelMessage } from './channel-router.ts';

export type InstanceInteractions = {
  status: PlayStatus;
  controlStates: ControlStates;
  pausedAt?: Call['id'];
  log: LogItem[];
  calls: Map<Call['id'], Call>;
  caughtException?: SerializedError;
  unhandledErrors?: SerializedError[];
  tracker: RenderTracker;
};

export type InteractionsRegistry = Record<string, InstanceInteractions>;

// A docs instance plays after its render completed, so the render's "completed" phase says nothing
// about the play. Only the play's own phases move the status.
const INSTANCE_PLAY_STATUS: Partial<Record<RenderPhase, PlayStatus>> = {
  playing: 'playing',
  played: 'completed',
  errored: 'errored',
  aborted: 'aborted',
};

const TERMINAL_STATUSES: PlayStatus[] = ['completed', 'errored', 'aborted'];

export function createInteractionsRegistry(): InteractionsRegistry {
  return {};
}

/**
 * Read one instance's Interactions panel state. An instance that has not reported yet is rendering.
 */
export function instanceInteractions(
  registry: InteractionsRegistry,
  instanceId: string,
  storyId: string
): InstanceInteractions {
  return registry[instanceId] ?? renderingInteractions(storyId, new Map(), { renderId: 0 });
}

/**
 * Apply one forwarded preview event to a single instance. Other instances keep their state.
 */
export function withInteractionMessage(
  registry: InteractionsRegistry,
  instanceId: string,
  storyId: string,
  message: ChannelMessage
): InteractionsRegistry {
  const current = instanceInteractions(registry, instanceId, storyId);
  const next = reduceMessage(current, storyId, message);
  return next === current ? registry : { ...registry, [instanceId]: next };
}

/**
 * Drop one instance so a later id reuse starts from a fresh render.
 */
export function withoutInteractionsInstance(
  registry: InteractionsRegistry,
  instanceId: string
): InteractionsRegistry {
  const { [instanceId]: _removed, ...rest } = registry;
  return rest;
}

function renderingInteractions(
  storyId: string,
  calls: Map<Call['id'], Call>,
  tracker: RenderTracker
): InstanceInteractions {
  return {
    status: 'rendering',
    controlStates: INITIAL_CONTROL_STATES,
    log: [getInternalRenderLogItem(CallStates.ACTIVE)],
    calls: new Map(calls).set(INTERNAL_RENDER_CALL_ID, getInternalRenderCall(storyId)),
    tracker,
  };
}

function reduceMessage(
  current: InstanceInteractions,
  storyId: string,
  { type, args }: ChannelMessage
): InstanceInteractions {
  const [payload] = args;
  if (type === EVENTS.CALL) {
    const { status: _status, ...call } = payload as Call;
    return { ...current, calls: new Map(current.calls).set(call.id, call) };
  }
  if (type === EVENTS.SYNC) {
    const sync = payload as SyncPayload;
    if (sync.storyId && sync.storyId !== storyId) {
      return current;
    }
    return {
      ...current,
      log: [getInternalRenderLogItem(CallStates.DONE), ...sync.logItems],
      controlStates: sync.controlStates,
      pausedAt: sync.pausedAt,
    };
  }
  if (type === STORY_RENDER_PHASE_CHANGED) {
    const event = payload as { storyId: string; newPhase: RenderPhase; renderId?: number };
    const { tracker, isCurrentRender } = trackRenderPhase(current.tracker, event, storyId);
    if (!isCurrentRender) {
      return tracker === current.tracker ? current : { ...current, tracker };
    }
    if (event.newPhase === 'rendering') {
      return renderingInteractions(storyId, current.calls, tracker);
    }
    const mapped = INSTANCE_PLAY_STATUS[event.newPhase];
    const status = mapped && !TERMINAL_STATUSES.includes(current.status) ? mapped : current.status;
    return { ...current, tracker, status, pausedAt: undefined };
  }
  if (type === STORY_THREW_EXCEPTION) {
    const error = payload as Required<SerializedError>;
    return {
      ...current,
      log: [getInternalRenderLogItem(CallStates.ERROR)],
      calls: new Map(current.calls).set(
        INTERNAL_RENDER_CALL_ID,
        getInternalRenderCall(storyId, { ...error, callId: INTERNAL_RENDER_CALL_ID })
      ),
      caughtException: undefined,
      controlStates: INITIAL_CONTROL_STATES,
      pausedAt: undefined,
    };
  }
  if (type === PLAY_FUNCTION_THREW_EXCEPTION) {
    return { ...current, caughtException: payload as SerializedError };
  }
  if (type === UNHANDLED_ERRORS_WHILE_PLAYING) {
    return { ...current, unhandledErrors: payload as SerializedError[] };
  }
  return current;
}
