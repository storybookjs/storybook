import * as fs from 'node:fs';
import { dirname, join } from 'node:path';

import { expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';

import * as m from './common-preset';

// mock src/core-server/utils/constants.ts:8:27
vi.mock('../utils/constants', () => {
  return {
    defaultStaticDirs: [{ from: './from', to: './to' }],
    defaultFavicon: join(
      dirname(require.resolve('storybook/package.json')),
      '/assets/browser/favicon.svg'
    ),
  };
});

vi.mock('../../shared/utils/module', () => ({
  resolvePackageDir: vi.fn().mockReturnValue('mocked-path'),
}));

const defaultFavicon = join(
  dirname(require.resolve('storybook/package.json')),
  '/assets/browser/favicon.svg'
);

const createPath = (...p: string[]) => join(process.cwd(), ...p);
const createOptions = (locations: string[]): Parameters<typeof m.favicon>[1] => ({
  configDir: '',
  presets: {
    apply: async (extension: string, config: any) => {
      switch (extension) {
        case 'staticDirs': {
          return locations.map((location) => ({ from: location, to: '/' }));
        }
        default: {
          return config as any;
        }
      }
    },
  },
});

vi.mock('storybook/internal/node-logger', () => {
  return {
    logger: {
      warn: vi.fn(() => {}),
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

  expect(await m.favicon(undefined, options)).toBe(defaultFavicon);
});

it('with staticDirs referencing a favicon.ico directly should return the found favicon', async () => {
  const location = 'favicon.ico';
  existsSyncMock.mockImplementation((p) => {
    return p === createPath(location);
  });
  statSyncMock.mockImplementation((p) => {
    return {
      isFile: () => p === createPath('favicon.ico'),
    } as any;
  });
  const options = createOptions([location]);

  expect(await m.favicon(undefined, options)).toBe(createPath('favicon.ico'));
});

it('with staticDirs containing a single favicon.ico should return the found favicon', async () => {
  const location = 'static';
  existsSyncMock.mockImplementation((p) => {
    if (p === createPath(location)) {
      return true;
    }
    if (p === createPath(location, 'favicon.ico')) {
      return true;
    }
    return false;
  });
  const options = createOptions([location]);

  expect(await m.favicon(undefined, options)).toBe(createPath(location, 'favicon.ico'));
});

it('with staticDirs containing a single favicon.svg should return the found favicon', async () => {
  const location = 'static';
  existsSyncMock.mockImplementation((p) => {
    if (p === createPath(location)) {
      return true;
    }
    if (p === createPath(location, 'favicon.svg')) {
      return true;
    }
    return false;
  });
  const options = createOptions([location]);

  expect(await m.favicon(undefined, options)).toBe(createPath(location, 'favicon.svg'));
});

it('with staticDirs containing a multiple favicons should return the first favicon and warn', async () => {
  const location = 'static';
  existsSyncMock.mockImplementation((p) => {
    if (p === createPath(location)) {
      return true;
    }
    if (p === createPath(location, 'favicon.ico')) {
      return true;
    }
    if (p === createPath(location, 'favicon.svg')) {
      return true;
    }
    return false;
  });
  const options = createOptions([location]);

  expect(await m.favicon(undefined, options)).toBe(createPath(location, 'favicon.svg'));

  expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('multiple favicons'));
});

it('with multiple staticDirs containing a multiple favicons should return the first favicon and warn', async () => {
  const locationA = 'static-a';
  const locationB = 'static-b';
  existsSyncMock.mockImplementation((p) => {
    if (p === createPath(locationA)) {
      return true;
    }
    if (p === createPath(locationB)) {
      return true;
    }
    if (p === createPath(locationA, 'favicon.ico')) {
      return true;
    }
    if (p === createPath(locationB, 'favicon.svg')) {
      return true;
    }
    return false;
  });
  const options = createOptions([locationA, locationB]);

  expect(await m.favicon(undefined, options)).toBe(createPath(locationA, 'favicon.ico'));

  expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('multiple favicons'));
});
