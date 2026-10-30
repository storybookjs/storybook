import type { ChannelLike } from 'storybook/internal/channels';

import { instanceIdFromSearch, isEventForInstance } from '../preview-participant.ts';
import {
  type ChannelState,
  type InstanceArgs,
  type InstanceEvent,
  type RouteDecision,
  dispatchInstanceEvent,
  registerInstance,
  unregisterInstance,
} from './channel-router.ts';

export const INSTANCE_CHANNEL_EVENT = 'experimental-manager-docs/instance';

export type InstanceTransport = {
  getState: () => ChannelState;
  register: (
    instanceId: string,
    storyId: string,
    args: InstanceArgs,
    globals: InstanceArgs
  ) => void;
  unregister: (instanceId: string) => void;
  updateArgs: (instanceId: string, storyId: string, args: InstanceArgs) => RouteDecision;
  updateGlobals: (instanceId: string, globals: InstanceArgs) => RouteDecision;
  startPlay: (instanceId: string) => RouteDecision;
  pausePlay: (instanceId: string) => RouteDecision;
  sendDebugger: (
    instanceId: string,
    storyId: string,
    type: string,
    payload?: Record<string, unknown>
  ) => RouteDecision;
  listen: (instanceId: string, listener: (event: InstanceEvent) => void) => () => void;
  disconnect: () => void;
};

// Rejected events, including the main canvas id, are not delivered to listeners.
export function connectInstanceTransport(
  channel: ChannelLike,
  initial: ChannelState
): InstanceTransport {
  let state = initial;
  let decision: RouteDecision = { status: 'reject', reason: 'missing-instance' };
  const listeners = new Set<(event: InstanceEvent, decision: RouteDecision) => void>();

  const onChannel = (event: InstanceEvent) => {
    const result = dispatchInstanceEvent(state, event);
    state = result.state;
    decision = result.decision;
    if (result.decision.status !== 'deliver') {
      return;
    }
    for (const listener of listeners) {
      listener(event, result.decision);
    }
  };

  channel.on(INSTANCE_CHANNEL_EVENT, onChannel);

  const send = (event: InstanceEvent): RouteDecision => {
    channel.emit(INSTANCE_CHANNEL_EVENT, {
      ...event,
      options: { target: event.instanceId },
    });
    return decision;
  };

  return {
    getState: () => state,
    register: (instanceId, storyId, args, globals) => {
      state = registerInstance(state, instanceId, storyId, args, globals);
    },
    unregister: (instanceId) => {
      state = unregisterInstance(state, instanceId);
    },
    updateArgs: (instanceId, storyId, args) => send({ kind: 'args', instanceId, storyId, args }),
    updateGlobals: (instanceId, globals) => send({ kind: 'globals', instanceId, globals }),
    startPlay: (instanceId) => send({ kind: 'play', instanceId, phase: 'start' }),
    pausePlay: (instanceId) => send({ kind: 'play', instanceId, phase: 'pause' }),
    sendDebugger: (instanceId, storyId, type, payload = {}) =>
      send({
        kind: 'debugger',
        instanceId,
        storyId,
        message: { type, args: [{ ...payload, storyId }] },
      }),
    listen: (instanceId, listener) => {
      const wrapped = (event: InstanceEvent, routed: RouteDecision) => {
        if (routed.status === 'deliver' && routed.instanceId === instanceId) {
          listener(event);
        }
      };
      listeners.add(wrapped);
      return () => listeners.delete(wrapped);
    },
    disconnect: () => channel.off(INSTANCE_CHANNEL_EVENT, onChannel),
  };
}

export function bindInstanceParticipant(
  channel: ChannelLike,
  search: string,
  onEvent: (event: InstanceEvent) => void,
  getInstanceId?: () => string | null
): { instanceId: string | null; dispose: () => void } {
  const fallback = instanceIdFromSearch(search);
  if (!fallback && !getInstanceId) {
    return { instanceId: null, dispose() {} };
  }
  const listener = (event: InstanceEvent) => {
    const instanceId = getInstanceId?.() ?? fallback;
    if (!instanceId || !isEventForInstance(instanceId, event)) {
      return;
    }
    onEvent(event);
  };
  channel.on(INSTANCE_CHANNEL_EVENT, listener);
  return {
    instanceId: fallback,
    dispose: () => channel.off(INSTANCE_CHANNEL_EVENT, listener),
  };
}
