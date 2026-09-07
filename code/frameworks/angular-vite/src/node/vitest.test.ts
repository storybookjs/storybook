import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';

import { type AngularVitestOptions, storybookAngularVitest } from './vitest.ts';

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

  it('exports storybookAngularVitest as a function (export contract)', () => {
    expect(typeof storybookAngularVitest).toBe('function');
  });
});
