// @vitest-environment happy-dom
import { Channel, type ChannelEvent } from 'storybook/internal/channels';
import {
  PLAY_FUNCTION_THREW_EXCEPTION,
  STORY_RENDER_PHASE_CHANGED,
} from 'storybook/internal/core-events';
import { describe, expect, it, vi } from 'vitest';

import { EVENTS } from '../../../../core/src/instrumenter/EVENTS.ts';
import { CallStates, type SyncPayload } from '../../../../core/src/instrumenter/types.ts';
import { deliverDebuggerEvent, forwardInstanceInteractions } from '../preview.ts';
import { storyFrameQuery } from '../preview-participant.ts';
import { createChannelState, registerInstance } from './channel-router.ts';
import {
  createInteractionsRegistry,
  instanceInteractions,
  type InteractionsRegistry,
  withInteractionMessage,
  withoutInteractionsInstance,
} from './instance-interactions.ts';
import { bindInstanceParticipant, connectInstanceTransport } from './instance-transport.ts';

const storyId = 'restaurant--with-modal-open';
const first = `${storyId}#1`;
const second = `${storyId}#2`;

const call = {
  id: `${storyId} [0] click`,
  cursor: 0,
  storyId,
  ancestors: [],
  path: ['userEvent'],
  method: 'click',
  args: [],
  interceptable: true,
  retain: false,
};

const sync: SyncPayload = {
  storyId,
  controlStates: {
    detached: false,
    start: true,
    back: true,
    goto: true,
    next: true,
    end: true,
  },
  logItems: [{ callId: call.id, status: CallStates.WAITING, ancestors: [] }],
  pausedAt: call.id,
};

const phase = (newPhase: string) => ({
  type: STORY_RENDER_PHASE_CHANGED,
  args: [{ storyId, newPhase, renderId: 1 }],
});

// Each preview iframe has its own channel; the manager only sees what a preview sends, and a
// targeted manager event reaches only the iframe whose instance id matches, as PostMessageTransport does.
function connectFrames() {
  const previews = new Map<string, Channel>();
  const manager = new Channel({
    transport: {
      setHandler: () => {},
      send: (event: ChannelEvent, options?: { target?: string }) => {
        if (options?.target) {
          previews.get(options.target)?.receive(event);
        }
      },
    },
  });
  for (const instanceId of [first, second]) {
    previews.set(
      instanceId,
      new Channel({
        transport: { setHandler: () => {}, send: (event: ChannelEvent) => manager.receive(event) },
      })
    );
  }
  const state = registerInstance(
    registerInstance(createChannelState(), first, storyId, {}, {}),
    second,
    storyId,
    {},
    {}
  );
  return { manager, previews, transport: connectInstanceTransport(manager, state) };
}

describe('instance interactions', () => {
  it('applies preview interaction events only to the instance that sent them', () => {
    const { previews, transport } = connectFrames();
    let registry: InteractionsRegistry = createInteractionsRegistry();
    for (const instanceId of [first, second]) {
      forwardInstanceInteractions(previews.get(instanceId)!, instanceId, storyId);
      transport.listen(instanceId, (event) => {
        if (event.kind === 'interactions' && event.message) {
          registry = withInteractionMessage(registry, instanceId, storyId, event.message);
        }
      });
    }
    const untouched = instanceInteractions(registry, second, storyId);

    const frame = previews.get(first)!;
    frame.emit(STORY_RENDER_PHASE_CHANGED, { storyId, newPhase: 'rendering', renderId: 1 });
    frame.emit(STORY_RENDER_PHASE_CHANGED, { storyId, newPhase: 'playing', renderId: 1 });
    frame.emit(EVENTS.CALL, { ...call, status: CallStates.WAITING });
    frame.emit(EVENTS.SYNC, sync);

    expect(instanceInteractions(registry, first, storyId)).toMatchObject({
      status: 'playing',
      pausedAt: call.id,
      controlStates: sync.controlStates,
    });
    expect(instanceInteractions(registry, first, storyId).log.map((item) => item.callId)).toEqual([
      'internal_render_call',
      call.id,
    ]);
    expect(instanceInteractions(registry, first, storyId).calls.get(call.id)).toEqual(call);
    expect(instanceInteractions(registry, second, storyId)).toEqual(untouched);

    transport.disconnect();
  });

  it('sends a debugger control only to the targeted iframe', () => {
    const { previews, transport } = connectFrames();
    const next = new Map([
      [first, vi.fn()],
      [second, vi.fn()],
    ]);
    for (const instanceId of [first, second]) {
      const frame = previews.get(instanceId)!;
      frame.on(EVENTS.NEXT, next.get(instanceId)!);
      bindInstanceParticipant(frame, `?${storyFrameQuery(storyId, instanceId)}`, (event) => {
        if (event.kind === 'debugger') {
          deliverDebuggerEvent(frame, event);
        }
      });
    }

    transport.sendDebugger(second, storyId, EVENTS.NEXT);

    expect(next.get(second)).toHaveBeenCalledWith({ storyId });
    expect(next.get(first)).not.toHaveBeenCalled();

    transport.disconnect();
  });

  it('refuses to replay a forwarded event that is not a debugger control', () => {
    const frame = new Channel({});
    const forceRemount = vi.fn();
    frame.on('forceRemount', forceRemount);

    deliverDebuggerEvent(frame, {
      kind: 'debugger',
      instanceId: first,
      message: { type: 'forceRemount', args: [{ storyId }] },
    });

    expect(forceRemount).not.toHaveBeenCalled();
  });

  it('waits for the deferred play instead of passing when the render completes', () => {
    let registry = createInteractionsRegistry();
    const statuses: string[] = [];
    for (const step of ['rendering', 'completed', 'playing', 'played']) {
      registry = withInteractionMessage(registry, first, storyId, phase(step));
      statuses.push(instanceInteractions(registry, first, storyId).status);
    }

    expect(statuses).toEqual(['rendering', 'rendering', 'playing', 'completed']);
  });

  it('keeps a play exception until the next render and forgets a removed instance', () => {
    const failed = [
      phase('rendering'),
      phase('playing'),
      { type: PLAY_FUNCTION_THREW_EXCEPTION, args: [{ name: 'Error', message: 'boom' }] },
      phase('errored'),
    ].reduce(
      (current, step) => withInteractionMessage(current, first, storyId, step),
      createInteractionsRegistry()
    );

    expect(instanceInteractions(failed, first, storyId)).toMatchObject({
      status: 'errored',
      caughtException: { message: 'boom' },
    });

    const rerendered = withInteractionMessage(failed, first, storyId, phase('rendering'));
    expect(instanceInteractions(rerendered, first, storyId).status).toBe('rendering');
    expect(instanceInteractions(rerendered, first, storyId).caughtException).toBeUndefined();

    expect(withoutInteractionsInstance(failed, first)).toEqual({});
  });

  it('ignores a sync for another story', () => {
    const registry = withInteractionMessage(createInteractionsRegistry(), first, storyId, {
      type: EVENTS.SYNC,
      args: [{ ...sync, storyId: 'other--story' }],
    });

    expect(registry).toEqual({});
  });
});
