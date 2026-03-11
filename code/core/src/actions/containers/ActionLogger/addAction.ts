import { dequal as deepEqual } from 'dequal';

import type { ActionDisplay } from '../../models';

const safeDeepEqual = (a: any, b: any): boolean => {
  try {
    return deepEqual(a, b);
  } catch (e) {
    return false;
  }
};

const DEFAULT_LIMIT = 50;

export function computeAddAction(
  prevActions: ActionDisplay[],
  action: ActionDisplay
): ActionDisplay[] {
  const limit = action.options.limit ?? DEFAULT_LIMIT;
  const previous = prevActions.length ? prevActions[prevActions.length - 1] : null;

  if (previous && safeDeepEqual(previous.data, action.data)) {
    const updated = [...prevActions];
    updated[updated.length - 1] = { ...previous, count: previous.count + 1 };
    return updated.slice(-limit);
  }

  const newAction = { ...action, count: 1 };
  return [...prevActions, newAction].slice(-limit);
}
