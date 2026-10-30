import { dequal as deepEqual } from 'dequal';

import type { ActionDisplay } from '../../../../core/src/actions/models/index.ts';
import { ACTION_EVENT_ID } from './action-events.ts';
import type { ChannelMessage } from './channel-router.ts';

export type ActionsRegistry = Record<string, ActionDisplay[]>;

export function createActionsRegistry(): ActionsRegistry {
  return {};
}

export function instanceActions(registry: ActionsRegistry, instanceId: string): ActionDisplay[] {
  return registry[instanceId] ?? [];
}

export function withActionMessage(
  registry: ActionsRegistry,
  instanceId: string,
  message: ChannelMessage
): ActionsRegistry {
  if (message.type !== ACTION_EVENT_ID) {
    return registry;
  }
  const action = message.args[0];
  if (!isActionDisplay(action)) {
    return registry;
  }
  return { ...registry, [instanceId]: appendAction(registry[instanceId] ?? [], action) };
}

export function clearInstanceActions(
  registry: ActionsRegistry,
  instanceId: string
): ActionsRegistry {
  if (!registry[instanceId]?.length) {
    return registry;
  }
  return { ...registry, [instanceId]: [] };
}

export function withoutActionsInstance(
  registry: ActionsRegistry,
  instanceId: string
): ActionsRegistry {
  const { [instanceId]: _removed, ...rest } = registry;
  return rest;
}

// Identical neighbors share one row and a count, then the list keeps the Actions panel's limit.
function appendAction(actions: readonly ActionDisplay[], action: ActionDisplay): ActionDisplay[] {
  const limit = action.options.limit ?? 50;
  const previous = actions.length > 0 ? actions[actions.length - 1] : undefined;
  if (previous && safeDeepEqual(previous.data, action.data)) {
    const updated = actions.slice();
    updated[updated.length - 1] = { ...previous, count: previous.count + 1 };
    return updated.slice(-limit);
  }
  return [...actions, { ...action, count: 1 }].slice(-limit);
}

function safeDeepEqual(left: unknown, right: unknown): boolean {
  try {
    return deepEqual(left, right);
  } catch {
    return false;
  }
}

function isActionDisplay(value: unknown): value is ActionDisplay {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const action = value as ActionDisplay;
  return typeof action.id === 'string' && typeof action.data?.name === 'string';
}
