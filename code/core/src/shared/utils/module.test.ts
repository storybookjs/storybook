import nodeModule from 'node:module';

import { afterEach, describe, expect, it, vi } from 'vitest';

// vitest-setup.ts globally mocks shared/utils/module.ts; these tests need the real implementation.
vi.unmock('./module.ts');

const importFreshModule = async () => {
  vi.resetModules();
  return import('./module.ts');
};

const hookRegistrations = (
  register: ReturnType<typeof vi.spyOn>,
  registerHooks: ReturnType<typeof vi.spyOn> | undefined
) => register.mock.calls.length + (registerHooks?.mock.calls.length ?? 0);

describe('importModule', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('still imports the module when the runtime forbids module hook registration', async () => {
    // The throwing spies simulate a refusing runtime and keep real hooks out of this process.
    vi.spyOn(nodeModule, 'register').mockImplementation(() => {
      throw new Error('module.register() is not supported in Jest');
    });
    if ('registerHooks' in nodeModule) {
      vi.spyOn(nodeModule, 'registerHooks').mockImplementation(() => {
        throw new Error('module.registerHooks() is not supported in Jest');
      });
    }
    const { importModule } = await importFreshModule();

    const mod = await importModule(new URL('./module.ts', import.meta.url).href);

    expect(mod).toBeDefined();
  });

  it('registers the TypeScript loader hooks exactly once when the runtime allows them', async () => {
    const register = vi.spyOn(nodeModule, 'register').mockImplementation(() => {});
    const registerHooks =
      'registerHooks' in nodeModule
        ? vi.spyOn(nodeModule, 'registerHooks').mockImplementation(() => ({ deregister: () => {} }))
        : undefined;
    const { importModule } = await importFreshModule();

    const mod = await importModule(new URL('./module.ts', import.meta.url).href);

    expect(hookRegistrations(register, registerHooks)).toBe(1);
    expect(mod).toBeDefined();
  });

  it('still registers the hooks when JEST_WORKER_ID is inherited from the parent environment', async () => {
    const register = vi.spyOn(nodeModule, 'register').mockImplementation(() => {});
    const registerHooks =
      'registerHooks' in nodeModule
        ? vi.spyOn(nodeModule, 'registerHooks').mockImplementation(() => ({ deregister: () => {} }))
        : undefined;
    vi.stubEnv('JEST_WORKER_ID', '1');
    const { importModule } = await importFreshModule();

    const mod = await importModule(new URL('./module.ts', import.meta.url).href);

    expect(hookRegistrations(register, registerHooks)).toBe(1);
    expect(mod).toBeDefined();
  });
});
