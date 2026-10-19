import nodeModule from 'node:module';

import { afterEach, describe, expect, it, vi } from 'vitest';

// vitest-setup.ts globally mocks shared/utils/module.ts; these tests need the real implementation.
vi.unmock('./module.ts');

const importFreshModule = async () => {
  vi.resetModules();
  return import('./module.ts');
};

const stubHookRegistration = (refuses: boolean) => {
  const register = vi.spyOn(nodeModule, 'register').mockImplementation(() => {
    if (refuses) {
      throw new Error('module.register() is not supported in Jest');
    }
  });
  const registerHooks =
    'registerHooks' in nodeModule
      ? vi.spyOn(nodeModule, 'registerHooks').mockImplementation(() => {
          if (refuses) {
            throw new Error('module.registerHooks() is not supported in Jest');
          }
          return { deregister: () => {} };
        })
      : undefined;

  return {
    // All hook registration attempts across both APIs.
    attempts: () => register.mock.calls.length + (registerHooks?.mock.calls.length ?? 0),
    // register() attempts only — pins that a refused registration is never retried.
    registerCalls: () => register.mock.calls.length,
  };
};

describe('importModule', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('still imports the module when the runtime forbids module hook registration', async () => {
    const hooks = stubHookRegistration(true);
    const { importModule } = await importFreshModule();

    const mod = await importModule(new URL('./module.ts', import.meta.url).href);
    // The refusal is cached: a runtime that refuses once is not retried on the next import.
    await importModule(new URL('./module.ts', import.meta.url).href);

    expect(mod).toBeDefined();
    expect(hooks.registerCalls()).toBe(1);
  });

  it.each([
    ['when the runtime allows them', false],
    ['when JEST_WORKER_ID is inherited from the parent environment', true],
  ])(
    'registers the TypeScript loader hooks exactly once %s',
    async (_condition, stubInheritedEnvironment) => {
      if (stubInheritedEnvironment) {
        vi.stubEnv('JEST_WORKER_ID', '1');
      }
      const hooks = stubHookRegistration(false);
      const { importModule } = await importFreshModule();

      const mod = await importModule(new URL('./module.ts', import.meta.url).href);
      // Calling twice is what makes the toBe(1) below prove memoization.
      await importModule(new URL('./module.ts', import.meta.url).href);

      expect(hooks.attempts()).toBe(1);
      expect(mod).toBeDefined();
    }
  );
});
