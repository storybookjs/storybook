import path, { join, normalize, relative } from 'node:path';
import { fileURLToPath, pathToFileURL, resolve } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';

import * as resolveUtils from '../shared/utils/module';
import { getPresets, loadPreset, resolveAddonName } from './presets';

function wrapPreset(basePresets: any): { babel: Function; webpack: Function } {
  return {
    babel: async (config: any, args: any) => basePresets.apply('babel', config, args),
    webpack: async (config: any, args: any) => basePresets.apply('webpack', config, args),
  };
}

vi.mock('storybook/internal/node-logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../shared/utils/module', () => ({
  importModule: vi.fn(),
  safeResolveModule: vi.fn(({ specifier }) => {
    const KNOWN_FILES = [
      '@storybook/react',
      'storybook/actions/manager',
      './local/preset',
      './local/addons',
      '/absolute/preset',
      '/absolute/addons',
      '@storybook/addon-docs',
      '@storybook/addon-cool',
      '@storybook/addon-docs/preset',
      '@storybook/addon-essentials',
      '@storybook/addon-knobs/manager',
      '@storybook/addon-knobs/register',
      '@storybook/addon-notes/register-panel',
      '@storybook/preset-create-react-app',
      '@storybook/preset-typescript',
      'addon-bar/preset.js',
      'addon-bar',
      'addon-baz/register.js',
      'addon-foo/register.js',
    ];
    if (KNOWN_FILES.includes(specifier)) {
      return specifier;
    }
    return undefined;
  }),
}));

const mockedResolveUtils = vi.mocked(resolveUtils);

describe('presets', () => {
  it('does not throw when there is no preset file', async () => {
    let presets;

    async function testPresets() {
      // @ts-expect-error (invalid use)
      presets = wrapPreset(await getPresets());
      await presets.webpack();
      await presets.babel();
    }

    await expect(testPresets()).resolves.toBeUndefined();

    expect(presets).toBeDefined();
  });
  it('does not throw when presets are empty', async () => {
    // @ts-expect-error (invalid use)
    const presets = wrapPreset(await getPresets([]));

    async function testPresets() {
      await presets.webpack();
      await presets.babel();
    }

    await expect(testPresets()).resolves.toBeUndefined();
  });

  it('does not throw when preset can not be loaded', async () => {
    // @ts-expect-error (invalid use)
    const presets = wrapPreset(await getPresets(['preset-foo']));

    async function testPresets() {
      await presets.webpack();
      await presets.babel();
    }

    await expect(testPresets()).resolves.toBeUndefined();
  });

  it('throws when preset can not be loaded and is critical', async () => {
    // @ts-expect-error (invalid use)
    await expect(getPresets(['preset-foo'], { isCritical: true })).rejects.toThrow();
  });

  it('loads and applies presets when they are combined in another preset', async () => {
    mockedResolveUtils.importModule.mockImplementation(async (path: string) => {
      if (path === 'preset-first') {
        return {
          aProperty: (existing: string[]) => existing.concat('first'),
        };
      }
      if (path === 'preset-second') {
        return {
          aProperty: (existing: string[]) => existing.concat('second'),
        };
      }
      if (path === 'preset-third') {
        return {
          presets: ['sub-preset'],
          aProperty: (existing: string[]) => existing.concat('third'),
        };
      }
      if (path === 'sub-preset') {
        return {
          aProperty: (existing: string[]) => existing.concat('sub-preset-fourth'),
        };
      }
      if (path === 'preset-fifth') {
        return {
          aProperty: (existing: string[]) => existing.concat('fifth'),
        };
      }
      throw new Error(`Could not resolve ${path}`);
    });

    const presets = await getPresets(
      ['preset-first', 'preset-second', 'preset-third', 'preset-fifth'],
      {} as any
    );

    const result = await presets.apply('aProperty', []);

    expect(result).toEqual(['first', 'second', 'sub-preset-fourth', 'third', 'fifth']);
  });

  it('loads and applies presets when they are declared as a string', async () => {
    const mockPresetFooExtendWebpack = vi.fn();
    const mockPresetBarExtendBabel = vi.fn();

    mockedResolveUtils.importModule.mockImplementation(async (path: string) => {
      if (path === 'preset-foo') {
        return {
          webpack: mockPresetFooExtendWebpack,
        };
      }
      if (path === 'preset-bar') {
        return {
          babel: mockPresetBarExtendBabel,
        };
      }
      throw new Error(`Could not resolve ${path}`);
    });

    const presets = wrapPreset(await getPresets(['preset-foo', 'preset-bar'], {} as any));

    async function testPresets() {
      await presets.webpack();
      await presets.babel();
    }

    await expect(testPresets()).resolves.toBeUndefined();

    expect(mockPresetFooExtendWebpack).toHaveBeenCalled();
    expect(mockPresetBarExtendBabel).toHaveBeenCalled();
  });

  it('loads and applies presets when they are declared as an object without props', async () => {
    const mockPresetFooExtendWebpack = vi.fn();
    const mockPresetBarExtendBabel = vi.fn();

    mockedResolveUtils.importModule.mockImplementation(async (path: string) => {
      if (path === 'preset-foo') {
        return {
          webpack: mockPresetFooExtendWebpack,
        };
      }
      if (path === 'preset-bar') {
        return {
          babel: mockPresetBarExtendBabel,
        };
      }
      throw new Error(`Could not resolve ${path}`);
    });

    const presets = wrapPreset(
      await getPresets([{ name: 'preset-foo' }, { name: 'preset-bar' }], {} as any)
    );

    async function testPresets() {
      await presets.webpack();
      await presets.babel();
    }

    await expect(testPresets()).resolves.toBeUndefined();

    expect(mockPresetFooExtendWebpack).toHaveBeenCalled();
    expect(mockPresetBarExtendBabel).toHaveBeenCalled();
  });

  it('loads and applies presets when they are declared as an object with props', async () => {
    const mockPresetFooExtendWebpack = vi.fn();
    const mockPresetBarExtendBabel = vi.fn();

    mockedResolveUtils.importModule.mockImplementation(async (path: string) => {
      if (path === 'preset-foo') {
        return {
          webpack: mockPresetFooExtendWebpack,
        };
      }
      if (path === 'preset-bar') {
        return {
          babel: mockPresetBarExtendBabel,
        };
      }
      throw new Error(`Could not resolve ${path}`);
    });

    const presets = wrapPreset(
      await getPresets(
        [
          { name: 'preset-foo', options: { foo: 1 } },
          { name: 'preset-bar', options: { bar: 'a' } },
        ],
        {} as any
      )
    );

    async function testPresets() {
      await presets.webpack({});
      await presets.babel({});
    }

    await expect(testPresets()).resolves.toBeUndefined();

    expect(mockPresetFooExtendWebpack).toHaveBeenCalledWith(expect.anything(), {
      foo: 1,
      presetsList: expect.anything(),
      presets: expect.anything(),
    });
    expect(mockPresetBarExtendBabel).toHaveBeenCalledWith(expect.anything(), {
      bar: 'a',
      presetsList: expect.anything(),
      presets: expect.anything(),
    });
  });

  it('loads and applies presets when they are declared as a string and as an object', async () => {
    const mockPresetFooExtendWebpack = vi.fn();
    const mockPresetBarExtendBabel = vi.fn();

    mockedResolveUtils.importModule.mockImplementation(async (path: string) => {
      if (path === 'preset-foo') {
        return {
          webpack: mockPresetFooExtendWebpack,
        };
      }
      if (path === 'preset-bar') {
        return {
          babel: mockPresetBarExtendBabel,
        };
      }
      throw new Error(`Could not resolve ${path}`);
    });

    const presets = wrapPreset(
      await getPresets(
        [
          'preset-foo',
          {
            name: 'preset-bar',
            options: {
              bar: 'a',
            },
          },
        ],
        {} as any
      )
    );

    async function testPresets() {
      await presets.webpack({});
      await presets.babel({});
    }

    await expect(testPresets()).resolves.toBeUndefined();

    expect(mockPresetFooExtendWebpack).toHaveBeenCalled();
    expect(mockPresetBarExtendBabel).toHaveBeenCalledWith(expect.anything(), {
      bar: 'a',
      presetsList: expect.arrayContaining([
        expect.objectContaining({ name: 'preset-foo' }),
        expect.objectContaining({ name: 'preset-bar' }),
      ]),
      presets: expect.anything(),
    });
  });

  it('applies presets in chain', async () => {
    const mockPresetFooExtendWebpack = vi.fn((...args: any[]) => ({}));
    const mockPresetBarExtendWebpack = vi.fn((...args: any[]) => ({}));

    mockedResolveUtils.importModule.mockImplementation(async (path: string) => {
      if (path === 'preset-foo') {
        return {
          webpack: mockPresetFooExtendWebpack,
        };
      }
      if (path === 'preset-bar') {
        return {
          webpack: mockPresetBarExtendWebpack,
        };
      }
      throw new Error(`Could not resolve ${path}`);
    });

    const presets = wrapPreset(
      await getPresets(
        [
          'preset-foo',
          {
            name: 'preset-bar',
            options: {
              bar: 'a',
              presetsList: expect.arrayContaining([
                expect.objectContaining({ name: 'preset-foo' }),
                expect.objectContaining({ name: 'preset-bar' }),
              ]),
              presets: expect.anything(),
            },
          },
        ],
        {} as any
      )
    );

    async function testPresets() {
      await presets.webpack();
      await presets.babel();
    }

    await expect(testPresets()).resolves.toBeUndefined();

    expect(mockPresetFooExtendWebpack).toHaveBeenCalled();
    expect(mockPresetBarExtendWebpack).toHaveBeenCalledWith(expect.anything(), {
      bar: 'a',
      presetsList: expect.arrayContaining([
        expect.objectContaining({ name: 'preset-foo' }),
        expect.objectContaining({ name: 'preset-bar' }),
      ]),
      presets: expect.anything(),
    });
  });

  it('allows for presets to export presets array', async () => {
    const input = {};
    const mockPresetBar = vi.fn((...args: any[]) => input);

    mockedResolveUtils.importModule.mockImplementation(async (path: string) => {
      if (path === 'preset-foo') {
        return {
          presets: ['preset-bar'],
        };
      }
      if (path === 'preset-bar') {
        return {
          bar: mockPresetBar,
        };
      }
      throw new Error(`Could not resolve ${path}`);
    });

    const presets = await getPresets(['preset-foo'], {} as any);

    const output = await presets.apply('bar');

    expect(mockPresetBar).toHaveBeenCalledWith(undefined, expect.any(Object));

    expect(input).toBe(output);
  });

  it('allows for presets to export presets fn', async () => {
    const input = {};
    const storybookOptions = { a: 1 };
    const presetOptions = { b: 2 };
    const mockPresetBar = vi.fn((...args: any[]) => input);
    const mockPresetFoo = vi.fn((...args: any[]) => ['preset-bar']);

    mockedResolveUtils.importModule.mockImplementation(async (path: string) => {
      if (path === 'preset-foo') {
        return {
          presets: mockPresetFoo,
        };
      }
      if (path === 'preset-bar') {
        return {
          bar: mockPresetBar,
        };
      }
      throw new Error(`Could not resolve ${path}`);
    });

    const presets = await getPresets(
      [{ name: 'preset-foo', options: { b: 2 } }],
      storybookOptions as any
    );

    const output = await presets.apply('bar');

    expect(mockPresetFoo).toHaveBeenCalledWith({ ...storybookOptions, ...presetOptions });
    expect(mockPresetBar).toHaveBeenCalledWith(undefined, expect.any(Object));

    expect(input).toBe(output);
  });

  afterEach(() => {
    vi.resetModules();
  });
});
describe('resolveAddonName', () => {
  it('should resolve packages with metadata (relative path)', () => {
    mockedResolveUtils.importModule.mockImplementation(async (path: string) => {
      if (path === './local/preset') {
        return {
          presets: [],
        };
      }
      throw new Error(`Could not resolve ${path}`);
    });
    expect(resolveAddonName({} as any, './local/preset', {})).toEqual({
      name: './local/preset',
      type: 'presets',
    });
  });

  it('should resolve packages with metadata (absolute path)', () => {
    mockedResolveUtils.importModule.mockImplementation(async (path: string) => {
      if (path === '/absolute/preset') {
        return {
          presets: [],
        };
      }
      throw new Error(`Could not resolve ${path}`);
    });
    expect(resolveAddonName({} as any, '/absolute/preset', {})).toEqual({
      name: '/absolute/preset',
      type: 'presets',
    });
  });

  it('should resolve packages without metadata', () => {
    expect(resolveAddonName({} as any, '@storybook/preset-create-react-app', {})).toEqual({
      name: '@storybook/preset-create-react-app',
      type: 'presets',
    });
  });

  it('should resolve presets', () => {
    expect(resolveAddonName({} as any, '@storybook/addon-docs/preset', {})).toEqual({
      name: '@storybook/addon-docs/preset',
      type: 'presets',
    });
  });

  it('should resolve preset packages', () => {
    expect(resolveAddonName({} as any, '@storybook/addon-essentials', {})).toEqual({
      name: '@storybook/addon-essentials',
      type: 'presets',
    });
  });
});

describe('loadPreset', () => {
  beforeEach(() => {
    vi.spyOn(logger, 'warn');
    mockedResolveUtils.importModule.mockImplementation(async (path: string) => {
      switch (path) {
        case '@storybook/react':
        case '@storybook/preset-typescript':
        case '@storybook/addon-docs/preset':
        case 'addon-foo/register.js':
        case '@storybook/addon-cool':
        case 'addon-baz/register.js':
        case '@storybook/addon-notes/register-panel':
          return {};
        case 'addon-bar':
          return {
            addons: ['@storybook/addon-cool'],
            presets: [],
          };
      }
      throw new Error(`Could not resolve ${path}`);
    });
  });

  it('should prepend framework field to list of presets', async () => {
    const loaded = await loadPreset(
      {
        name: '',
        // @ts-expect-error (invalid use)
        type: 'virtual',
        framework: '@storybook/react',
        presets: ['@storybook/preset-typescript'],
        addons: ['@storybook/addon-docs/preset'],
      },
      0,
      {}
    );
    expect(loaded).toMatchInlineSnapshot(`
      [
        {
          "name": "@storybook/preset-typescript",
          "options": {},
          "preset": {},
        },
        {
          "name": "@storybook/addon-docs/preset",
          "options": {},
          "preset": {},
        },
        {
          "name": {
            "addons": [
              "@storybook/addon-docs/preset",
            ],
            "framework": "@storybook/react",
            "name": "",
            "presets": [
              "@storybook/preset-typescript",
            ],
            "type": "virtual",
          },
          "options": {},
          "preset": {
            "framework": "@storybook/react",
          },
        },
      ]
    `);
  });

  it.skip('should resolve all addons & presets in correct order', async () => {
    const loaded = await loadPreset(
      {
        name: '',
        // @ts-expect-error (invalid use)
        type: 'virtual',
        presets: ['@storybook/preset-typescript'],
        addons: [
          '@storybook/addon-docs/preset',
          'addon-foo/register.js',
          'addon-bar',
          'addon-baz/register.js',
          '@storybook/addon-notes/register-panel',
        ],
      },
      0,
      {}
    );
    expect(loaded).toEqual([
      {
        name: '@storybook/preset-typescript',
        options: {},
        preset: {},
      },
      {
        name: '@storybook/addon-docs/preset',
        options: {},
        preset: {},
      },
      {
        name: 'addon-foo/register.js',
        options: {},
        preset: {
          managerEntries: [normalize('addon-foo/register')],
        },
      },
      {
        name: '@storybook/addon-cool',
        options: {},
        preset: {},
      },
      {
        name: 'addon-bar',
        options: {},
        preset: {},
      },
      {
        name: 'addon-baz/register.js',
        options: {},
        preset: {
          managerEntries: [normalize('addon-baz/register')],
        },
      },
      {
        name: '@storybook/addon-notes/register-panel',
        options: {},
        preset: {
          managerEntries: [normalize('@storybook/addon-notes/register-panel')],
        },
      },
      {
        name: {
          presets: ['@storybook/preset-typescript'],
          addons: [
            '@storybook/addon-docs/preset',
            'addon-foo/register.js',
            'addon-bar',
            'addon-baz/register.js',
            '@storybook/addon-notes/register-panel',
          ],
          name: '',
          type: 'virtual',
        },
        options: {},
        preset: {},
      },
    ]);
  });

  it('should warn for addons that are not installed', async () => {
    const loaded = await loadPreset(
      {
        name: '',
        // @ts-expect-error (invalid use)
        type: 'virtual',
        framework: '@storybook/react',
        presets: ['@storybook/preset-typescript'],
        addons: ['@storybook/addon-docs/preset', 'uninstalled-addon'],
      },
      0,
      {}
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'Could not resolve addon "uninstalled-addon", skipping. Is it installed?'
    );
    expect(loaded).toMatchInlineSnapshot(`
      [
        {
          "name": "@storybook/preset-typescript",
          "options": {},
          "preset": {},
        },
        {
          "name": "@storybook/addon-docs/preset",
          "options": {},
          "preset": {},
        },
        {
          "name": {
            "addons": [
              "@storybook/addon-docs/preset",
              "uninstalled-addon",
            ],
            "framework": "@storybook/react",
            "name": "",
            "presets": [
              "@storybook/preset-typescript",
            ],
            "type": "virtual",
          },
          "options": {},
          "preset": {
            "framework": "@storybook/react",
          },
        },
      ]
    `);
  });

  it('should filter out disabledAddons', async () => {
    const loaded = await loadPreset(
      {
        name: '',
        // @ts-expect-error (invalid use)
        type: 'virtual',
        framework: '@storybook/react',
        presets: ['@storybook/preset-typescript'],
        addons: ['@storybook/addon-docs', 'addon-bar'],
      },
      0,
      {
        build: {
          test: {
            disabledAddons: ['@storybook/addon-docs'],
          },
        },
      }
    );

    // addon-docs should not be at the top level, but addon-bar and others should be.
    expect(loaded).toMatchInlineSnapshot(`
      [
        {
          "name": "@storybook/preset-typescript",
          "options": {},
          "preset": {},
        },
        {
          "name": "@storybook/addon-cool",
          "options": {},
          "preset": {},
        },
        {
          "name": "addon-bar",
          "options": {},
          "preset": {},
        },
        {
          "name": {
            "addons": [
              "@storybook/addon-docs",
              "addon-bar",
            ],
            "framework": "@storybook/react",
            "name": "",
            "presets": [
              "@storybook/preset-typescript",
            ],
            "type": "virtual",
          },
          "options": {},
          "preset": {
            "framework": "@storybook/react",
          },
        },
      ]
    `);
  });
});
