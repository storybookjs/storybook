import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { register } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The global vitest setup replaces `importModule` with a stub for every test. This suite tests
// the real implementation, so undo that here.
vi.unmock('./module.ts');

vi.mock('node:module', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:module')>();
  return {
    ...actual,
    register: vi.fn(),
  };
});

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
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('registers the TypeScript loader once across calls', async () => {
    const importModule = await loadImportModule();

    await expect(importModule(fixture)).resolves.toEqual({ loaded: true });
    await expect(importModule(fixture)).resolves.toEqual({ loaded: true });

    expect(register).toHaveBeenCalledTimes(1);
  });

  it('still imports the module when the runtime forbids registering loader hooks', async () => {
    // Jest >= 30.5 throws from `module.register()` inside its sandbox (jestjs/jest#16391).
    vi.mocked(register).mockImplementation(() => {
      throw new Error('module.register() is not supported in Jest');
    });
    const importModule = await loadImportModule();

    await expect(importModule(fixture)).resolves.toEqual({ loaded: true });
  });

  it('does not retry a registration that already failed', async () => {
    vi.mocked(register).mockImplementation(() => {
      throw new Error('module.register() is not supported in Jest');
    });
    const importModule = await loadImportModule();

    await importModule(fixture);
    await importModule(fixture);

    expect(register).toHaveBeenCalledTimes(1);
  });

  it('surfaces the registration error as the cause when the module cannot be loaded at all', async () => {
    const registrationError = new Error('module.register() is not supported in Jest');
    vi.mocked(register).mockImplementation(() => {
      throw registrationError;
    });
    const importModule = await loadImportModule();

    await expect(importModule(join(dir, 'missing.mjs'))).rejects.toMatchObject({
      cause: registrationError,
    });
  });
});
