// @vitest-environment happy-dom
import { Channel, type ChannelEvent } from 'storybook/internal/channels';
import { describe, expect, it } from 'vitest';

import { forwardInstanceActions } from '../preview.ts';
import { ACTION_EVENT_ID } from './action-events.ts';
import { createChannelState, registerInstance } from './channel-router.ts';
import {
  createActionsRegistry,
  instanceActions,
  type ActionsRegistry,
  withActionMessage,
} from './instance-actions.ts';
import { connectInstanceTransport } from './instance-transport.ts';

const storyId = 'restaurant--with-modal-open';
const first = `${storyId}#1`;
const second = `${storyId}#2`;

const clicked = {
  id: 'action-click',
  count: 0,
  data: { name: 'onClick', args: ['card'] },
  options: { limit: 50 },
};

const closed = {
  id: 'action-close',
  count: 0,
  data: { name: 'onClose', args: [] },
  options: { limit: 50 },
};

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
  return { previews, transport: connectInstanceTransport(manager, state) };
}

describe('instance actions', () => {
  it('keeps an action event on the instance that emitted it', () => {
    const { previews, transport } = connectFrames();
    let registry: ActionsRegistry = createActionsRegistry();
    for (const instanceId of [first, second]) {
      forwardInstanceActions(previews.get(instanceId)!, instanceId, storyId);
      transport.listen(instanceId, (event) => {
        if (event.kind === 'actions' && event.message) {
          registry = withActionMessage(registry, instanceId, event.message);
        }
      });
    }

    previews.get(first)!.emit(ACTION_EVENT_ID, clicked);
    previews.get(second)!.emit(ACTION_EVENT_ID, closed);

    expect(instanceActions(registry, first)).toEqual([{ ...clicked, count: 1 }]);
    expect(instanceActions(registry, second)).toEqual([{ ...closed, count: 1 }]);
    expect(instanceActions(registry, first).map((action) => action.id)).not.toContain(closed.id);
    expect(instanceActions(registry, second).map((action) => action.id)).not.toContain(clicked.id);

    transport.disconnect();
  });
});
