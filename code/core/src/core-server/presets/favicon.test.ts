import { dirname, join } from 'node:path';

import { expect, it, vi } from 'vitest';

import { logger } from '@storybook/core/node-logger';

import * as fs from 'fs-extra';

import * as m from './common-preset';

const defaultFavicon = join(
  dirname(require.resolve('@storybook/core/package.json')),
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

vi.mock('fs-extra', () => {
  return {
    pathExists: vi.fn((p: string) => {
      return false;
    }),
    existsSync: vi.fn((p: string) => {
      return false;
    }),
  };
});

vi.mock('@storybook/core/node-logger', () => {
  return {
    logger: {
      warn: vi.fn(() => {}),
    },
  };
});

const pathExists = vi.mocked(fs.pathExists);

it('with no staticDirs favicon should return default', async () => {
  const options = createOptions([]);

  expect(await m.favicon(undefined, options)).toBe(defaultFavicon);
});

it('with staticDirs containing a single favicon.ico should return the found favicon', async () => {
  const location = 'static';
  pathExists.mockImplementation((p: string) => {
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
  pathExists.mockImplementation((p: string) => {
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
  pathExists.mockImplementation((p: string) => {
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
  pathExists.mockImplementation((p: string) => {
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
