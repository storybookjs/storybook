import nodeModule from 'node:module';

import { afterEach, describe, expect, it, vi } from 'vitest';

// vitest-setup.ts globally mocks shared/utils/module.ts; these tests need the real implementation.
vi.unmock('./module.ts');

const realRegister = nodeModule.register;
const realRegisterHooks = nodeModule.registerHooks;

const importFreshModule = async () => {
  vi.resetModules();
  return import('./module.ts');
};

describe('importModule', () => {
  afterEach(() => {
    (nodeModule as any).register = realRegister;
    (nodeModule as any).registerHooks = realRegisterHooks;
    vi.unstubAllEnvs();
  });

  it('does not register module hooks when running under Jest', async () => {
    const register = vi.fn(() => {
      throw new Error('module.register() is not supported in Jest');
    });
    const registerHooks = vi.fn(() => {
      throw new Error('module.registerHooks() is not supported in Jest');
    });
    (nodeModule as any).register = register;
    (nodeModule as any).registerHooks = registerHooks;
    vi.stubEnv('JEST_WORKER_ID', '1');
    const { importModule } = await importFreshModule();

    const mod = await importModule(new URL('./module.ts', import.meta.url).href);

    expect(register).not.toHaveBeenCalled();
    expect(registerHooks).not.toHaveBeenCalled();
    expect(mod).toBeDefined();
  });

  it('still registers the TypeScript loader hooks when not running under Jest', async () => {
    const register = vi.fn();
    const registerHooks = vi.fn();
    (nodeModule as any).register = register;
    (nodeModule as any).registerHooks = registerHooks;
    const { importModule } = await importFreshModule();

    const mod = await importModule(new URL('./module.ts', import.meta.url).href);

    expect(register.mock.calls.length + registerHooks.mock.calls.length).toBe(1);
    expect(mod).toBeDefined();
  });
});
