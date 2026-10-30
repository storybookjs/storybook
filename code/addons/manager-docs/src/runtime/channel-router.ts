import { MAIN_CANVAS_ID } from '../constants.ts';
import { ManagerDocsError } from '../errors.ts';

export type InstanceArgs = Record<string, unknown>;

export type PlayPhase = 'ready' | 'absent' | 'start' | 'pause' | 'resume' | 'done' | 'error';

export type RoutedInstance = {
  storyId: string;
  args: InstanceArgs;
  globals: InstanceArgs;
  height: number | null;
  play: PlayPhase | null;
};

export type ChannelState = {
  instances: Record<string, RoutedInstance>;
};

export type ChannelMessage = { type: string; args: unknown[] };

export type InstanceEvent = {
  kind: 'args' | 'globals' | 'height' | 'play' | 'interactions' | 'actions' | 'debugger';
  instanceId?: string;
  storyId?: string;
  args?: InstanceArgs;
  globals?: InstanceArgs;
  height?: number;
  phase?: PlayPhase;
  message?: ChannelMessage;
};

export type RouteReason =
  | 'missing-instance'
  | 'unknown-instance'
  | 'main-canvas'
  | 'foreign-story'
  | 'invalid-height';

export type RouteDecision =
  | { status: 'deliver'; instanceId: string }
  | { status: 'reject'; reason: RouteReason };

/**
 * Create an empty instance routing table.
 */
export function createChannelState(): ChannelState {
  return { instances: {} };
}

/**
 * Register one story instance. The same story id may be registered more than once.
 */
export function registerInstance(
  state: ChannelState,
  instanceId: string,
  storyId: string,
  args: InstanceArgs,
  globals: InstanceArgs
): ChannelState {
  if (instanceId === MAIN_CANVAS_ID || instanceId === '') {
    throw new ManagerDocsError('Refusing to register the main canvas as a story instance.');
  }
  if (state.instances[instanceId]) {
    throw new ManagerDocsError(`Story instance "${instanceId}" is already registered.`);
  }
  return {
    instances: {
      ...state.instances,
      [instanceId]: {
        storyId,
        args: structuredClone(args),
        globals: structuredClone(globals),
        height: null,
        play: null,
      },
    },
  };
}

/**
 * Remove one story instance so its id can be registered again. Unknown ids are ignored.
 */
export function unregisterInstance(state: ChannelState, instanceId: string): ChannelState {
  if (!state.instances[instanceId]) {
    return state;
  }
  const { [instanceId]: _removed, ...instances } = state.instances;
  return { instances };
}

/**
 * Deliver one channel event to a single instance, or reject it.
 *
 * An event with only a story id is rejected. Two instances of that story must not both observe it.
 */
export function dispatchInstanceEvent(
  state: ChannelState,
  event: InstanceEvent
): { state: ChannelState; decision: RouteDecision } {
  if (!event.instanceId) {
    return { state, decision: { status: 'reject', reason: 'missing-instance' } };
  }
  if (event.instanceId === MAIN_CANVAS_ID) {
    return { state, decision: { status: 'reject', reason: 'main-canvas' } };
  }
  const current = state.instances[event.instanceId];
  if (!current) {
    return { state, decision: { status: 'reject', reason: 'unknown-instance' } };
  }
  if (event.storyId !== undefined && event.storyId !== current.storyId) {
    return { state, decision: { status: 'reject', reason: 'foreign-story' } };
  }
  if (
    event.kind === 'height' &&
    (typeof event.height !== 'number' || !Number.isFinite(event.height) || event.height < 0)
  ) {
    return { state, decision: { status: 'reject', reason: 'invalid-height' } };
  }

  const next = applyEvent(current, event);
  return {
    state: {
      instances: {
        ...state.instances,
        [event.instanceId]: next,
      },
    },
    decision: { status: 'deliver', instanceId: event.instanceId },
  };
}

function applyEvent(current: RoutedInstance, event: InstanceEvent): RoutedInstance {
  if (event.kind === 'args') {
    return { ...current, args: structuredClone(event.args ?? {}) };
  }
  if (event.kind === 'globals') {
    return { ...current, globals: structuredClone(event.globals ?? {}) };
  }
  if (event.kind === 'height') {
    return { ...current, height: event.height ?? null };
  }
  if (event.kind === 'play') {
    return { ...current, play: event.phase ?? null };
  }
  return current;
}
