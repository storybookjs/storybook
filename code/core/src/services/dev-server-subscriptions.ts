import { getInstanceContext } from '../shared/instance-context.ts';

const DEV_SERVER_SUBSCRIPTIONS = Symbol.for('storybook.instance.dev-server-subscriptions');
const FALLBACK_DEV_SERVER_SUBSCRIPTIONS: Array<() => void> = [];

export function getDevServerSubscriptions(): Array<() => void> {
  const context = getInstanceContext();
  if (!context) {
    return FALLBACK_DEV_SERVER_SUBSCRIPTIONS;
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
