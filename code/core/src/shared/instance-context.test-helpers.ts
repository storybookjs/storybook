import { aroundEach } from 'vitest';

import type { ChannelLike } from '../channels/types.ts';
import { instanceContext } from '../instance/instance-context.ts';
import type { InstanceContext } from './instance-context.ts';

/** Creates a bare instance context, as `createStorybook` would, without loading a project. */
export function createTestInstanceContext(workingDir: string = process.cwd()): InstanceContext {
  const channel = { on() {}, off() {}, emit() {} } as unknown as ChannelLike;
  return {
    channel,
    workingDir,
    state: new Map(),
    cleanups: new Set(),
    getStoryIndexGenerator: () => Promise.reject(new Error('No story index in a test context')),
  };
}

/** Runs each test of the calling suite, with its `beforeEach`/`afterEach` hooks, in a fresh test instance. */
export function useTestInstance(): void {
  aroundEach((runTest) => runInTestInstance(runTest));
}

/** Runs `run` inside `context`, then runs its cleanups as `storybook.close()` would. */
export async function runInTestInstance<T>(
  run: () => T | Promise<T>,
  context: InstanceContext = createTestInstanceContext()
): Promise<T> {
  try {
    return await instanceContext.run(context, run);
  } finally {
    await instanceContext.run(context, () =>
      Promise.all([...context.cleanups].map((cleanup) => cleanup()))
    );
  }
}
