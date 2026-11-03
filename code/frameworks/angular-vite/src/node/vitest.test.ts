import { readFileSync } from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';

import { type AngularVitestOptions, COMPILER_SETUP, storybookAngularVitest } from './vitest.ts';

vi.mock('storybook/internal/node-logger', () => ({
  logger: { warn: vi.fn() },
}));

const ENV_KEY = 'STORYBOOK_ANGULAR_BUILDER_OPTIONS_JSON';

describe('storybookAngularVitest', () => {
  beforeEach(() => {
    delete process.env[ENV_KEY];
    vi.mocked(logger.warn).mockClear();
  });

  afterEach(() => {
    delete process.env[ENV_KEY];
  });

  it('sets the env var to the serialized options and returns the named plugin', () => {
    const options: AngularVitestOptions = {
      zoneless: false,
      styles: ['src/styles.css'],
      stylePreprocessorOptions: { loadPaths: ['src/styles'] },
    };

    const plugin = storybookAngularVitest(options);

    expect(plugin.name).toBe('storybook:angular-vitest-options');
    expect(JSON.parse(process.env[ENV_KEY] as string)).toEqual(options);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('serializes omitted/empty options to {}', () => {
    storybookAngularVitest();

    expect(process.env[ENV_KEY]).toBe('{}');
  });

  it('keeps the existing env value and warns once when options differ (no-clobber)', () => {
    process.env[ENV_KEY] = JSON.stringify({ zoneless: true });

    storybookAngularVitest({ zoneless: false });

    expect(JSON.parse(process.env[ENV_KEY] as string)).toEqual({ zoneless: true });
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('does not warn when the existing env value equals the serialized options', () => {
    const options: AngularVitestOptions = { zoneless: false, styles: ['a.css'] };
    process.env[ENV_KEY] = JSON.stringify(options);

    storybookAngularVitest(options);

    expect(JSON.parse(process.env[ENV_KEY] as string)).toEqual(options);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('throws on non-serializable options and leaves the env var unset', () => {
    const circular: AngularVitestOptions = {};
    circular.self = circular;

    expect(() => storybookAngularVitest(circular)).toThrow(/non-serializable/);
    expect(process.env[ENV_KEY]).toBeUndefined();
  });

  it('registers the compiler wrapper as a setup file, not the bare @angular/compiler specifier', () => {
    const config = (storybookAngularVitest().config as () => { test: { setupFiles: string[] } })();

    // Vitest re-imports setup files under a fresh URL per test file; a bare specifier would
    // re-evaluate the compiler each time.
    expect(config.test.setupFiles).toEqual([COMPILER_SETUP]);
    expect(config.test.setupFiles).not.toContain('@angular/compiler');
  });

  it('exports the compiler wrapper, which only imports @angular/compiler', () => {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
    const subpath = COMPILER_SETUP.replace('@storybook/angular-vite', '.');
    const source = readFileSync(
      new URL('../client/vitest-compiler-setup.ts', import.meta.url),
      'utf8'
    );

    expect(pkg.exports[subpath]).toBe('./dist/client/vitest-compiler-setup.js');
    expect(source.replace(/^\s*\/\/.*$/gm, '').trim()).toBe("import '@angular/compiler';");
  });

  it('exports storybookAngularVitest as a function (export contract)', () => {
    expect(typeof storybookAngularVitest).toBe('function');
  });
});
