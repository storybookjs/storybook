import * as fs from 'node:fs';

import { expect, it, vi } from 'vitest';

import { logger } from '@storybook/core/internal/node-logger';

import { dirname, join, normalize } from 'pathe';

import * as m from './common-defaults.ts';

// mock src/core-server/utils/constants.ts:8:27
vi.mock('@storybook/core/internal/deep/common/utils/constants', () => {
  return {
    defaultStaticDirs: [{ from: './from', to: './to' }],
    defaultFavicon: join(
      dirname(require.resolve('storybook/package.json')),
      '/assets/browser/favicon.svg'
    ),
  };
});

vi.mock('@storybook/core/internal/deep/utils/module', () => ({
  resolvePackageDir: vi.fn().mockReturnValue('mocked-path'),
}));

const defaultFavicon = join(
  dirname(require.resolve('storybook/package.json')),
  '/assets/browser/favicon.svg'
);

const createPath = (...p: string[]) => join(process.cwd(), ...p);
/** Options and instance in one object: the instance's static dirs serve these locations. */
const createOptions = (
  locations: string[]
): Parameters<typeof m.favicon>[1] & Parameters<typeof m.favicon>[2] =>
  ({
    configDir: '',
    workingDir: process.cwd(),
    callHook: async () => locations.map((location) => ({ from: location, to: '/' })),
  }) as unknown as Parameters<typeof m.favicon>[1] & Parameters<typeof m.favicon>[2];

vi.mock('@storybook/core/internal/node-logger', () => {
  return {
    logger: {
      debug: vi.fn(() => {}),
    },
  };
});

vi.mock('node:fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:fs')>()),
  existsSync: vi.fn((p: string) => {
    return false;
  }),
  statSync: vi.fn((p: string) => {
    return {
      isFile: () => false,
    };
  }),
}));
const existsSyncMock = vi.mocked(fs.existsSync);
const statSyncMock = vi.mocked(fs.statSync);

it('with no staticDirs favicon should return default', async () => {
  const options = createOptions([]);

  expect(await m.favicon(undefined, options, options)).toBe(defaultFavicon);
});

it('with staticDirs referencing a favicon.ico directly should return the found favicon', async () => {
  const location = 'favicon.ico';
  existsSyncMock.mockImplementation((p) => {
    return normalize(String(p)) === normalize(createPath(location));
  });
  statSyncMock.mockImplementation((p) => {
    return {
      isFile: () => normalize(String(p)) === normalize(createPath('favicon.ico')),
    } as any;
  });
  const options = createOptions([location]);

  expect(normalize(await m.favicon(undefined, options, options))).toBe(
    normalize(createPath('favicon.ico'))
  );
});

it('with staticDirs containing a single favicon.ico should return the found favicon', async () => {
  const location = 'static';
  existsSyncMock.mockImplementation((p) => {
    if (normalize(String(p)) === normalize(createPath(location))) {
      return true;
    }
    if (normalize(String(p)) === normalize(createPath(location, 'favicon.ico'))) {
      return true;
    }
    return false;
  });
  const options = createOptions([location]);

  expect(normalize(await m.favicon(undefined, options, options))).toBe(
    normalize(createPath(location, 'favicon.ico'))
  );
});

it('with staticDirs containing a single favicon.svg should return the found favicon', async () => {
  const location = 'static';
  existsSyncMock.mockImplementation((p) => {
    if (normalize(String(p)) === normalize(createPath(location))) {
      return true;
    }
    if (normalize(String(p)) === normalize(createPath(location, 'favicon.svg'))) {
      return true;
    }
    return false;
  });
  const options = createOptions([location]);

  expect(normalize(await m.favicon(undefined, options, options))).toBe(
    normalize(createPath(location, 'favicon.svg'))
  );
});

it('with staticDirs containing a multiple favicons should return the first favicon and show a debug message', async () => {
  const location = 'static';
  existsSyncMock.mockImplementation((p) => {
    if (normalize(String(p)) === normalize(createPath(location))) {
      return true;
    }
    if (normalize(String(p)) === normalize(createPath(location, 'favicon.ico'))) {
      return true;
    }
    if (normalize(String(p)) === normalize(createPath(location, 'favicon.svg'))) {
      return true;
    }
    return false;
  });
  const options = createOptions([location]);

  expect(normalize(await m.favicon(undefined, options, options))).toBe(
    normalize(createPath(location, 'favicon.svg'))
  );

  expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('multiple favicons'));
});

it('with multiple staticDirs containing a multiple favicons should return the first favicon and show a debug message', async () => {
  const locationA = 'static-a';
  const locationB = 'static-b';
  existsSyncMock.mockImplementation((p) => {
    if (normalize(String(p)) === normalize(createPath(locationA))) {
      return true;
    }
    if (normalize(String(p)) === normalize(createPath(locationB))) {
      return true;
    }
    if (normalize(String(p)) === normalize(createPath(locationA, 'favicon.ico'))) {
      return true;
    }
    if (normalize(String(p)) === normalize(createPath(locationB, 'favicon.svg'))) {
      return true;
    }
    return false;
  });
  const options = createOptions([locationA, locationB]);

  expect(normalize(await m.favicon(undefined, options, options))).toBe(
    normalize(createPath(locationA, 'favicon.ico'))
  );

  expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('multiple favicons'));
});
