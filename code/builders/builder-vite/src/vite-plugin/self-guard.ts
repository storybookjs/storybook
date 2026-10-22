import { AsyncLocalStorage } from 'node:async_hooks';

const PLUGIN_DISABLED = new AsyncLocalStorage<true>();

export function isPluginDisabled(): boolean {
  return PLUGIN_DISABLED.getStore() === true;
}

export function withPluginDisabled<T>(fn: () => Promise<T>): Promise<T> {
  return PLUGIN_DISABLED.run(true, fn);
}
