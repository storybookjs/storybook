import { afterEach, expect, it, vi } from 'vitest';

import { transform } from 'next/dist/build/swc/index.js';

import nextBabelPreset from './babel/preset.ts';
import { configureNextBabel } from './framework-config.ts';
import swcLoader from './swc/next-swc-loader-patch.ts';

vi.mock('@babel/core', () => ({
  loadPartialConfigAsync: vi.fn().mockResolvedValue({ options: {} }),
}));
vi.mock('next/dist/build/swc/index.js', () => ({
  transform: vi.fn().mockResolvedValue({ code: 'compiled' }),
}));
vi.mock('next/dist/build/swc/options.js', () => ({
  getLoaderSWCOptions: vi.fn(() => ({ env: {} })),
}));

// Every core bundle reads the running instance's context from this process-wide carrier.
const INSTANCE_STORAGE = Symbol.for('storybook.instance.storage');

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

it.each([
  { instance: true, flag: true, global: false, bugfixes: undefined },
  { instance: true, flag: false, global: true, bugfixes: true },
  { instance: true, flag: undefined, global: true, bugfixes: true },
  { instance: false, flag: undefined, global: true, bugfixes: undefined },
  { instance: false, flag: undefined, global: false, bugfixes: true },
])(
  'configures Babel and SWC with $bugfixes bugfixes for $instance instance / $flag flag / $global global',
  async ({ instance, flag, global, bugfixes }) => {
    vi.stubGlobal('FEATURES', { babelRemoveBugfixes: global });
    vi.stubGlobal(INSTANCE_STORAGE, {
      getStore: () =>
        instance
          ? {
              features: flag === undefined ? undefined : { babelRemoveBugfixes: flag },
              state: new Map(),
              workingDir: process.cwd(),
            }
          : undefined,
    });
    const config = await configureNextBabel({});
    expect(
      (config.overrides?.[0].presets?.[0] as [string, { bugfixes?: boolean }])[1].bugfixes
    ).toBe(bugfixes);

    const preset = nextBabelPreset({
      caller: (callback: (caller: unknown) => unknown) => callback({}),
    });
    expect((preset.presets?.[0] as [unknown, { bugfixes?: boolean }])[1].bugfixes).toBe(bugfixes);

    await new Promise<void>((resolve, reject) => {
      swcLoader.call(
        {
          resourcePath: '/project/story.stories.ts',
          getOptions: () => ({ rootDir: '/project', pagesDir: '/project/pages' }),
          async: () => (error: Error | null) => (error ? reject(error) : resolve()),
        },
        'export const story = {};',
        undefined
      );
    });
    expect(vi.mocked(transform).mock.calls[0][1]).toEqual(
      expect.objectContaining({
        env: bugfixes === undefined ? {} : { bugfixes },
      })
    );
  }
);
