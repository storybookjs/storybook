import type { ActionDisplay } from '../../models';

/**
 * Safely compare two objects for deep equality
 */
export function safeDeepEqual(a: any, b: any): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * Pure function to add an action to the action list.
 * Handles count incrementing for consecutive same actions and limit enforcement.
 *
 * @param prevActions - Current list of actions
 * @param action - New action to add
 * @returns New array of actions with the new action added
 */
export function addAction(prevActions: ActionDisplay[], action: ActionDisplay): ActionDisplay[] {
  const previous = prevActions.length ? prevActions[prevActions.length - 1] : null;

  if (previous && safeDeepEqual(previous.data, action.data)) {
    // Create new object instead of mutating
    const updated = [...prevActions];
    updated[updated.length - 1] = { ...previous, count: previous.count + 1 };
    return updated.slice(-(action.options.limit ?? 10));
  } else {
    // Create new object instead of mutating incoming action
    const newAction = { ...action, count: 1 };
    return [...prevActions, newAction].slice(-(action.options.limit ?? 10));
  }
}
