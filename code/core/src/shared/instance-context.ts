import type { Storybook } from '../instance/types.ts';
import type { Options } from '@storybook/core/internal/types';

import type { ChannelLike } from '../channels/types.ts';
import type { StoryIndexGenerator } from '../story-index/StoryIndexGenerator.ts';

export interface InstanceContext {
  storybook?: Storybook;
  features?: Options['features'];
  channel: ChannelLike | null;
  workingDir: string;
  state: Map<symbol, unknown>;
  cleanups: Set<() => void | Promise<void>>;
  getStoryIndexGenerator(): Promise<StoryIndexGenerator>;
}

export interface InstanceStorage {
  getStore(): InstanceContext | undefined;
  run<T>(context: InstanceContext, fn: () => T): T;
}

export const INSTANCE_STORAGE = Symbol.for('storybook.instance.storage');

export function getInstanceStorage(): InstanceStorage | undefined {
  return (globalThis as Record<symbol, InstanceStorage | undefined>)[INSTANCE_STORAGE];
}

/** Read the context of the Storybook instance running this operation. */
export function getInstanceContext(): InstanceContext | undefined {
  return getInstanceStorage()?.getStore();
}

/** Capture the current instance so `fn` still sees it when called from outside the async chain. */
export function bindToInstance<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => TResult
): (...args: TArgs) => TResult {
  const storage = getInstanceStorage();
  const context = storage?.getStore();
  return context && storage ? (...args) => storage.run(context, () => fn(...args)) : fn;
}
