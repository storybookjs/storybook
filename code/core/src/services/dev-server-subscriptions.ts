import { StorybookInstanceUnavailableError } from '@storybook/core/internal/server-errors';

import { getInstanceContext } from '../shared/instance-context.ts';

const DEV_SERVER_SUBSCRIPTIONS = Symbol.for('storybook.instance.dev-server-subscriptions');

/** The running instance's subscriptions that start with its dev server. */
export function getDevServerSubscriptions(): Array<() => void> {
  const context = getInstanceContext();
  if (!context) {
    throw new StorybookInstanceUnavailableError({ reason: 'outside-instance' });
  }
  if (!context.state.has(DEV_SERVER_SUBSCRIPTIONS)) {
    const subscriptions: Array<() => void> = [];
    context.state.set(DEV_SERVER_SUBSCRIPTIONS, subscriptions);
    context.cleanups.add(() => {
      subscriptions.length = 0;
    });
  }
  return context.state.get(DEV_SERVER_SUBSCRIPTIONS) as Array<() => void>;
}
