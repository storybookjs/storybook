import { AsyncLocalStorage } from 'node:async_hooks';

import { StorybookInstanceUnavailableError } from '@storybook/core/internal/server-errors';

import {
  INSTANCE_STORAGE,
  getInstanceContext,
  type InstanceContext,
} from '../shared/instance-context.ts';
import type { Storybook } from './types.ts';

export { bindToInstance } from '../shared/instance-context.ts';

const CONTEXTS = new WeakMap<object, InstanceContext>();
const STORAGE_GLOBAL = globalThis as Record<symbol, AsyncLocalStorage<InstanceContext>>;

// Presets can load another bundle of core, so all Node entries must share the context carrier.
export const instanceContext = (STORAGE_GLOBAL[INSTANCE_STORAGE] ??=
  new AsyncLocalStorage<InstanceContext>());

/** The Storybook running the current operation; throws outside one and while main.ts loads. */
export function getStorybook(): Storybook {
  const context = getInstanceContext();
  if (!context?.storybook) {
    throw new StorybookInstanceUnavailableError({
      reason: context ? 'loading-main' : 'outside-instance',
    });
  }
  return context.storybook;
}

/** The Storybook running the current operation, or `undefined` outside one. */
export function tryGetStorybook(): Storybook | undefined {
  return getInstanceContext()?.storybook;
}

export function registerInstanceContext(storybook: object, context: InstanceContext): void {
  CONTEXTS.set(storybook, context);
}

/** Run `fn` as an operation of `storybook`, for tests and hosts that hold the instance. */
export function runWithStorybook<T>(storybook: Storybook, fn: () => T): T {
  const context = CONTEXTS.get(storybook);
  if (!context) {
    throw new Error('Unknown Storybook instance.');
  }
  return instanceContext.run(context, fn);
}
