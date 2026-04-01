import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as find from 'empathic/find';

import { PackageManagerName } from '.';
import { executeCommandSync } from '../utils/command';
import { BUNProxy } from './BUNProxy';
import { JsPackageManagerFactory } from './JsPackageManagerFactory';
import { NPMProxy } from './NPMProxy';
import { PNPMProxy } from './PNPMProxy';
import { Yarn1Proxy } from './Yarn1Proxy';
import { Yarn2Proxy } from './Yarn2Proxy';

vi.mock('../utils/command', { spy: true });
const executeCommandSyncMock = vi.mocked(executeCommandSync);

vi.mock('empathic/find');
const findMock = vi.mocked(find);

vi.mock('node:fs', { spy: true });
const readFileSyncMock = vi.mocked(readFileSync);

describe('CLASS: JsPackageManagerFactory', () => {
  beforeEach(() => {
    JsPackageManagerFactory.clearCache();
    findMock.up.mockReturnValue(undefined);
    findMock.any.mockReturnValue(undefined);
    executeCommandSyncMock.mockImplementation(() => {
      throw new Error('Command not found');
    });
    delete process.env.npm_config_user_agent;
  });

  describe('METHOD: getPackageManager', () => {
    describe('NPM proxy', () => {
      it('FORCE: it should return a NPM proxy when `force` option is `npm`', () => {
        expect(
          JsPackageManagerFactory.getPackageManager({ force: PackageManagerName.NPM })
        ).toBeInstanceOf(NPMProxy);
      });

      it('USER AGENT: it should infer npm from the user agent', () => {
        process.env.npm_config_user_agent = 'npm/7.24.0';
        expect(JsPackageManagerFactory.getPackageManager()).toBeInstanceOf(NPMProxy);
      });

      it('ALL EXIST: when all package managers are ok, but only a `package-lock.json` file is found', () => {
        executeCommandSyncMock.mockImplementation((options) => {
          // Yarn is ok
          if (options.command === 'yarn' && options.args?.[0] === '--version') {
            return '1.22.4';
          }
          // NPM is ok
          if (options.command === 'npm' && options.args?.[0] === '--version') {
            return '6.5.12';
          }
          // PNPM is ok
          if (options.command === 'pnpm' && options.args?.[0] === '--version') {
            return '7.9.5';
          }
          // Unknown package manager is ko
          throw new Error('Command not found');
        });

        // There is only a package-lock.json
        findMock.up.mockImplementation((filename) => {
          if (typeof filename === 'string' && filename === 'package-lock.json') {
            return '/Users/johndoe/Documents/package-lock.json';
          }
          return undefined;
        });

        expect(JsPackageManagerFactory.getPackageManager()).toBeInstanceOf(NPMProxy);
      });
    });

    describe('PNPM proxy', () => {
      it('FORCE: it should return a PNPM proxy when `force` option is `pnpm`', () => {
        expect(
          JsPackageManagerFactory.getPackageManager({ force: PackageManagerName.PNPM })
        ).toBeInstanceOf(PNPMProxy);
      });

      it('USER AGENT: it should infer pnpm from the user agent', () => {
        process.env.npm_config_user_agent = 'pnpm/7.4.0';
        expect(JsPackageManagerFactory.getPackageManager()).toBeInstanceOf(PNPMProxy);
      });

      it('ALL EXIST: when all package managers are ok, but only a `pnpm-lock.yaml` file is found', () => {
        executeCommandSyncMock.mockImplementation((options) => {
          // Yarn is ok
          if (options.command === 'yarn' && options.args?.[0] === '--version') {
            return '1.22.4';
          }
          // NPM is ok
          if (options.command === 'npm' && options.args?.[0] === '--version') {
            return '6.5.12';
          }
          // PNPM is ok
          if (options.command === 'pnpm' && options.args?.[0] === '--version') {
            return '7.9.5';
          }
          // Unknown package manager is ko
          throw new Error('Command not found');
        });

        // There is only a pnpm-lock.yaml
        findMock.up.mockImplementation((filename) => {
          if (typeof filename === 'string' && filename === 'pnpm-lock.yaml') {
            return '/Users/johndoe/Documents/pnpm-lock.yaml';
          }
          return undefined;
        });

        expect(JsPackageManagerFactory.getPackageManager()).toBeInstanceOf(PNPMProxy);
      });

      it('PNPM LOCK IF CLOSER: when a pnpm-lock.yaml file is closer than a yarn.lock', async () => {
        // Use real find.up for lockfile resolution but exclude .yarnrc.yml
        // so the test doesn't depend on the host repo's own Yarn Berry config
        const realFind = await vi.importActual<typeof import('empathic/find')>('empathic/find');
        findMock.up.mockImplementation((filename, opts) => {
          if (typeof filename === 'string' && filename === '.yarnrc.yml') {
            return undefined;
          }
          return realFind.up(filename, opts);
        });

        executeCommandSyncMock.mockImplementation((options) => {
          // Yarn is ok
          if (options.command === 'yarn' && options.args?.[0] === '--version') {
            return '1.22.4';
          }
          // NPM is ok
          if (options.command === 'npm' && options.args?.[0] === '--version') {
            return '6.5.12';
          }
          // PNPM is ok
          if (options.command === 'pnpm' && options.args?.[0] === '--version') {
            return '7.9.5';
          }
          // Unknown package manager is ko
          throw new Error('Command not found');
        });
        const fixture = join(__dirname, 'fixtures', 'pnpm-workspace', 'package');
        expect(JsPackageManagerFactory.getPackageManager({}, fixture)).toBeInstanceOf(PNPMProxy);
      });
    });

    describe('Yarn 1 proxy', () => {
      it('FORCE: it should return a Yarn1 proxy when `force` option is `yarn1`', () => {
        expect(
          JsPackageManagerFactory.getPackageManager({ force: PackageManagerName.YARN1 })
        ).toBeInstanceOf(Yarn1Proxy);
      });

      it('USER AGENT: it should infer yarn1 from the user agent', () => {
        process.env.npm_config_user_agent = 'yarn/1.22.11';
        expect(JsPackageManagerFactory.getPackageManager()).toBeInstanceOf(Yarn1Proxy);
      });

      it('when Yarn command is ok and a yarn.lock file is found', () => {
        executeCommandSyncMock.mockImplementation((options) => {
          // Yarn is ok
          if (options.command === 'yarn' && options.args?.[0] === '--version') {
            return '1.22.4';
          }
          // NPM is ko
          if (options.command === 'npm' && options.args?.[0] === '--version') {
            throw new Error('Command not found');
          }
          // PNPM is ko
          if (options.command === 'pnpm' && options.args?.[0] === '--version') {
            throw new Error('Command not found');
          }
          // Unknown package manager is ko
          throw new Error('Command not found');
        });

        // there is a yarn.lock file
        findMock.up.mockImplementation((filename) => {
          if (typeof filename === 'string' && filename === 'yarn.lock') {
            return '/Users/johndoe/Documents/yarn.lock';
          }
          return undefined;
        });

        expect(JsPackageManagerFactory.getPackageManager()).toBeInstanceOf(Yarn1Proxy);
      });

      it('when Yarn command is ok, Yarn version is <2, NPM and PNPM are ok, there is a `yarn.lock` file', () => {
        executeCommandSyncMock.mockImplementation((options) => {
          // Yarn is ok
          if (options.command === 'yarn' && options.args?.[0] === '--version') {
            return '1.22.4';
          }
          // NPM is ok
          if (options.command === 'npm' && options.args?.[0] === '--version') {
            return '6.5.12';
          }
          // PNPM is ok
          if (options.command === 'pnpm' && options.args?.[0] === '--version') {
            return '7.9.5';
          }
          // Unknown package manager is ko
          throw new Error('Command not found');
        });

        // There is a yarn.lock
        findMock.up.mockImplementation((filename) => {
          if (typeof filename === 'string' && filename === 'yarn.lock') {
            return '/Users/johndoe/Documents/yarn.lock';
          }
          return undefined;
        });

        expect(JsPackageManagerFactory.getPackageManager()).toBeInstanceOf(Yarn1Proxy);
      });

      it('when multiple lockfiles are in a project, prefers yarn', async () => {
        // Use real find.up for lockfile resolution but exclude .yarnrc.yml
        // so the test doesn't depend on the host repo's own Yarn Berry config
        const realFind = await vi.importActual<typeof import('empathic/find')>('empathic/find');
        findMock.up.mockImplementation((filename, opts) => {
          if (typeof filename === 'string' && filename === '.yarnrc.yml') {
            return undefined;
          }
          return realFind.up(filename, opts);
        });

        executeCommandSyncMock.mockImplementation((options) => {
          // Yarn is ok
          if (options.command === 'yarn' && options.args?.[0] === '--version') {
            return '1.22.4';
          }
          // NPM is ok
          if (options.command === 'npm' && options.args?.[0] === '--version') {
            return '6.5.12';
          }
          // PNPM is ok
          if (options.command === 'pnpm' && options.args?.[0] === '--version') {
            return '7.9.5';
          }
          // Unknown package manager is ko
          throw new Error('Command not found');
        });
        const fixture = join(__dirname, 'fixtures', 'multiple-lockfiles');
        expect(JsPackageManagerFactory.getPackageManager({}, fixture)).toBeInstanceOf(Yarn1Proxy);
      });
    });

    describe('Yarn 2 proxy', () => {
      it('FORCE: it should return a Yarn2 proxy when `force` option is `yarn2`', () => {
        expect(
          JsPackageManagerFactory.getPackageManager({ force: PackageManagerName.YARN2 })
        ).toBeInstanceOf(Yarn2Proxy);
      });

      it('USER AGENT: it should infer yarn2 from the user agent', () => {
        process.env.npm_config_user_agent = 'yarn/2.2.10';
        expect(JsPackageManagerFactory.getPackageManager()).toBeInstanceOf(Yarn2Proxy);
      });

      it('ONLY YARN 2: when Yarn command is ok, Yarn version is >=2, NPM is ko, PNPM is ko, and a yarn.lock file is found', () => {
        executeCommandSyncMock.mockImplementation((options) => {
          // Yarn is ok
          if (options.command === 'yarn' && options.args?.[0] === '--version') {
            return '2.0.0-rc.33';
          }
          // NPM is ko
          if (options.command === 'npm' && options.args?.[0] === '--version') {
            throw new Error('Command not found');
          }
          // PNPM is ko
          if (options.command === 'pnpm' && options.args?.[0] === '--version') {
            throw new Error('Command not found');
          }
          // Unknown package manager is ko
          throw new Error('Command not found');
        });

        findMock.up.mockImplementation((filename) => {
          if (typeof filename === 'string' && filename === 'yarn.lock') {
            return '/Users/johndoe/Documents/yarn.lock';
          }
          return undefined;
        });

        expect(JsPackageManagerFactory.getPackageManager()).toBeInstanceOf(Yarn2Proxy);
      });

      it('when Yarn command is ok, Yarn version is >=2, NPM and PNPM are ok, there is a `yarn.lock` file', () => {
        executeCommandSyncMock.mockImplementation((options) => {
          // Yarn is ok
          if (options.command === 'yarn' && options.args?.[0] === '--version') {
            return '2.0.0-rc.33';
          }
          // NPM is ok
          if (options.command === 'npm' && options.args?.[0] === '--version') {
            return '6.5.12';
          }
          // PNPM is ok
          if (options.command === 'pnpm' && options.args?.[0] === '--version') {
            return '7.9.5';
          }
          // Unknown package manager is ko
          throw new Error('Command not found');
        });

        // There is a yarn.lock
        findMock.up.mockImplementation((filename) => {
          if (typeof filename === 'string' && filename === 'yarn.lock') {
            return '/Users/johndoe/Documents/yarn.lock';
          }
          return undefined;
        });

        expect(JsPackageManagerFactory.getPackageManager()).toBeInstanceOf(Yarn2Proxy);
      });

      it('BERRY VIA .yarnrc.yml: when yarn --version reports 1.x but .yarnrc.yml exists', () => {
        executeCommandSyncMock.mockImplementation((options) => {
          // Yarn reports 1.x (global yarn classic)
          if (options.command === 'yarn' && options.args?.[0] === '--version') {
            return '1.22.4';
          }
          // NPM is ko
          if (options.command === 'npm' && options.args?.[0] === '--version') {
            throw new Error('Command not found');
          }
          throw new Error('Command not found');
        });

        findMock.up.mockImplementation((filename) => {
          if (typeof filename === 'string' && filename === 'yarn.lock') {
            return '/Users/johndoe/Documents/yarn.lock';
          }
          if (typeof filename === 'string' && filename === '.yarnrc.yml') {
            return '/Users/johndoe/Documents/.yarnrc.yml';
          }
          return undefined;
        });

        expect(JsPackageManagerFactory.getPackageManager()).toBeInstanceOf(Yarn2Proxy);
      });

      it('BERRY VIA packageManager FIELD: when yarn --version reports 1.x but package.json has packageManager yarn@4.1.0', () => {
        executeCommandSyncMock.mockImplementation((options) => {
          // Yarn reports 1.x (global yarn classic)
          if (options.command === 'yarn' && options.args?.[0] === '--version') {
            return '1.22.4';
          }
          // NPM is ko
          if (options.command === 'npm' && options.args?.[0] === '--version') {
            throw new Error('Command not found');
          }
          throw new Error('Command not found');
        });

        findMock.up.mockImplementation((filename) => {
          if (typeof filename === 'string' && filename === 'yarn.lock') {
            return '/Users/johndoe/Documents/yarn.lock';
          }
          if (typeof filename === 'string' && filename === 'package.json') {
            return '/Users/johndoe/Documents/package.json';
          }
          return undefined;
        });

        readFileSyncMock.mockImplementation((filePath, encoding) => {
          if (
            typeof filePath === 'string' &&
            filePath === '/Users/johndoe/Documents/package.json' &&
            encoding === 'utf-8'
          ) {
            return JSON.stringify({ packageManager: 'yarn@4.1.0' });
          }
          throw new Error('File not found');
        });

        expect(JsPackageManagerFactory.getPackageManager()).toBeInstanceOf(Yarn2Proxy);
      });

      it('BERRY VIA packageManager FIELD WITH HASH: when package.json has packageManager yarn@4.1.0+sha256.xxx', () => {
        executeCommandSyncMock.mockImplementation((options) => {
          if (options.command === 'yarn' && options.args?.[0] === '--version') {
            return '1.22.4';
          }
          if (options.command === 'npm' && options.args?.[0] === '--version') {
            throw new Error('Command not found');
          }
          throw new Error('Command not found');
        });

        findMock.up.mockImplementation((filename) => {
          if (typeof filename === 'string' && filename === 'yarn.lock') {
            return '/Users/johndoe/Documents/yarn.lock';
          }
          if (typeof filename === 'string' && filename === 'package.json') {
            return '/Users/johndoe/Documents/package.json';
          }
          return undefined;
        });

        readFileSyncMock.mockImplementation((filePath, encoding) => {
          if (
            typeof filePath === 'string' &&
            filePath === '/Users/johndoe/Documents/package.json' &&
            encoding === 'utf-8'
          ) {
            return JSON.stringify({
              packageManager:
                'yarn@4.1.0+sha256.81a00df816059803e6b5148acf03ce313cad36b7f6e5af6efa040a8db86b7e8f',
            });
          }
          throw new Error('File not found');
        });

        expect(JsPackageManagerFactory.getPackageManager()).toBeInstanceOf(Yarn2Proxy);
      });

      it('BERRY v3: when yarn --version reports 3.x', () => {
        executeCommandSyncMock.mockImplementation((options) => {
          if (options.command === 'yarn' && options.args?.[0] === '--version') {
            return '3.6.4';
          }
          if (options.command === 'npm' && options.args?.[0] === '--version') {
            throw new Error('Command not found');
          }
          throw new Error('Command not found');
        });

        findMock.up.mockImplementation((filename) => {
          if (typeof filename === 'string' && filename === 'yarn.lock') {
            return '/Users/johndoe/Documents/yarn.lock';
          }
          return undefined;
        });

        expect(JsPackageManagerFactory.getPackageManager()).toBeInstanceOf(Yarn2Proxy);
      });

      it('BERRY v4: when yarn --version reports 4.x', () => {
        executeCommandSyncMock.mockImplementation((options) => {
          if (options.command === 'yarn' && options.args?.[0] === '--version') {
            return '4.1.0';
          }
          if (options.command === 'npm' && options.args?.[0] === '--version') {
            throw new Error('Command not found');
          }
          throw new Error('Command not found');
        });

        findMock.up.mockImplementation((filename) => {
          if (typeof filename === 'string' && filename === 'yarn.lock') {
            return '/Users/johndoe/Documents/yarn.lock';
          }
          return undefined;
        });

        expect(JsPackageManagerFactory.getPackageManager()).toBeInstanceOf(Yarn2Proxy);
      });

      it('BERRY WHEN YARN FAILS: when yarn command fails but .yarnrc.yml exists', () => {
        executeCommandSyncMock.mockImplementation(() => {
          // All commands fail
          throw new Error('Command not found');
        });

        findMock.up.mockImplementation((filename) => {
          if (typeof filename === 'string' && filename === 'yarn.lock') {
            return '/Users/johndoe/Documents/yarn.lock';
          }
          if (typeof filename === 'string' && filename === '.yarnrc.yml') {
            return '/Users/johndoe/Documents/.yarnrc.yml';
          }
          return undefined;
        });

        expect(JsPackageManagerFactory.getPackageManager()).toBeInstanceOf(Yarn2Proxy);
      });
    });

    describe('BUN proxy', () => {
      it('FORCE: it should return a BUN proxy when `force` option is `bun`', () => {
        expect(
          JsPackageManagerFactory.getPackageManager({ force: PackageManagerName.BUN })
        ).toBeInstanceOf(BUNProxy);
      });

      it('when Bun command is ok, NPM and PNPM are ok, there is a `bun.lockb` file', () => {
        executeCommandSyncMock.mockImplementation((options) => {
          // Bun is ok
          if (options.command === 'bun' && options.args?.[0] === '--version') {
            return '1.0.0';
          }
          // Yarn is ok
          if (options.command === 'yarn' && options.args?.[0] === '--version') {
            return '2.0.0-rc.33';
          }
          // NPM is ok
          if (options.command === 'npm' && options.args?.[0] === '--version') {
            return '6.5.12';
          }
          // PNPM is ok
          if (options.command === 'pnpm' && options.args?.[0] === '--version') {
            return '7.9.5';
          }
          // Unknown package manager is ko
          throw new Error('Command not found');
        });

        // There is a bun.lockb
        findMock.up.mockImplementation((filename) => {
          if (typeof filename === 'string' && filename === 'bun.lockb') {
            return '/Users/johndoe/Documents/bun.lockb';
          }
          return undefined;
        });

        expect(JsPackageManagerFactory.getPackageManager()).toBeInstanceOf(BUNProxy);
      });
    });

    it('throws an error if Yarn, NPM, and PNPM are not found', () => {
      executeCommandSyncMock.mockImplementation(() => {
        throw new Error('Command not found');
      });
      findMock.up.mockReturnValue(undefined);
      expect(() => JsPackageManagerFactory.getPackageManager()).toThrow();
    });
  });
});
