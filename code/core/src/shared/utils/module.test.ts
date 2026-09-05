import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import nodeModule from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';

// The global vitest setup replaces `importModule` with a stub for every test. This suite tests
// the real implementation, so undo that here.
vi.unmock('./module.ts');

vi.mock('node:module', { spy: true });

const registrationError = new Error('module.register() is not supported in Jest');

const loadImportModule = async () => {
  // `importModule` keeps the "loader registered" flag in module scope, so every test needs a
  // fresh copy of the module to start from an unregistered state.
  vi.resetModules();
  return (await import('./module.ts')).importModule;
};

describe('importModule', () => {
  let dir: string;
  let fixture: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sb-import-module-'));
    fixture = join(dir, 'fixture.mjs');
    writeFileSync(fixture, 'export default { loaded: true };\n');
    // Never install a loader hook in the process running these tests.
    vi.mocked(nodeModule.register).mockImplementation(() => undefined);
    vi.mocked(nodeModule.registerHooks)?.mockImplementation(() => undefined);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('registers the TypeScript loader once across calls', async () => {
    const importModule = await loadImportModule();

    await expect(importModule(fixture)).resolves.toEqual({ loaded: true });
    await expect(importModule(fixture)).resolves.toEqual({ loaded: true });

    expect(nodeModule.register).toHaveBeenCalledTimes(1);
  });

  describe('when the runtime forbids registering loader hooks', () => {
    beforeEach(() => {
      // Jest >= 30.5 throws from `module.register()` inside its sandbox (jestjs/jest#16391).
      vi.mocked(nodeModule.register).mockImplementation(() => {
        throw registrationError;
      });
    });

    it('still imports the module', async () => {
      const importModule = await loadImportModule();

      await expect(importModule(fixture)).resolves.toEqual({ loaded: true });
    });

    it('does not retry the registration on later calls', async () => {
      const importModule = await loadImportModule();

      await importModule(fixture);
      await importModule(fixture);

      expect(nodeModule.register).toHaveBeenCalledTimes(1);
    });

    it('logs the failure as a string, since the logger would serialize an Error to `{}`', async () => {
      const importModule = await loadImportModule();

      await importModule(fixture);

      expect(vi.mocked(logger.debug)).toHaveBeenCalledWith(
        expect.stringContaining('module.register() is not supported in Jest')
      );
    });

    it('surfaces the registration error as the cause when the module cannot be loaded at all', async () => {
      const importModule = await loadImportModule();

      await expect(importModule(join(dir, 'missing.mjs'))).rejects.toMatchObject({
        cause: registrationError,
      });
    });
  });

  // `registerHooks` landed in Node 22.15, so skip rather than crash on an older runtime.
  describe.skipIf(typeof nodeModule.registerHooks !== 'function')('on Node >= 26', () => {
    const runtimeNodeVersion = process.versions.node;

    beforeEach(() => {
      Object.defineProperty(process.versions, 'node', { value: '26.0.0', configurable: true });
    });

    afterEach(() => {
      Object.defineProperty(process.versions, 'node', {
        value: runtimeNodeVersion,
        configurable: true,
      });
    });

    it('installs the loader through registerHooks rather than register', async () => {
      const importModule = await loadImportModule();

      await expect(importModule(fixture)).resolves.toEqual({ loaded: true });

      expect(nodeModule.registerHooks).toHaveBeenCalledTimes(1);
      expect(nodeModule.register).not.toHaveBeenCalled();
    });

    describe('when the runtime forbids both hook APIs', () => {
      beforeEach(() => {
        // Jest rejects `registerHooks` for the same reason it rejects `register`, and the
        // registerHooks branch falls back to `register`, so both have to be survivable.
        vi.mocked(nodeModule.registerHooks).mockImplementation(() => {
          throw registrationError;
        });
        vi.mocked(nodeModule.register).mockImplementation(() => {
          throw registrationError;
        });
      });

      it('still imports the module', async () => {
        const importModule = await loadImportModule();

        await expect(importModule(fixture)).resolves.toEqual({ loaded: true });

        expect(nodeModule.registerHooks).toHaveBeenCalledTimes(1);
        expect(nodeModule.register).toHaveBeenCalledTimes(1);
      });
    });
  });
});
