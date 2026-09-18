import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as find from 'empathic/find';
import * as walk from 'empathic/walk';

import { PackageManagerName } from './index.ts';
import { executeCommandSync } from '../utils/command.ts';
import { getProjectRoot } from '../utils/paths.ts';
import { BUNProxy } from './BUNProxy.ts';
import { JsPackageManagerFactory } from './JsPackageManagerFactory.ts';
import { NPMProxy } from './NPMProxy.ts';
import { PNPMProxy } from './PNPMProxy.ts';
import { Yarn1Proxy } from './Yarn1Proxy.ts';
import { Yarn2Proxy } from './Yarn2Proxy.ts';

vi.mock('../utils/command', { spy: true });
const executeCommandSyncMock = vi.mocked(executeCommandSync);

vi.mock('empathic/find');
const findMock = vi.mocked(find);

vi.mock('empathic/walk');
const walkMock = vi.mocked(walk);

vi.mock('../utils/paths', { spy: true });
const getProjectRootMock = vi.mocked(getProjectRoot);

vi.mock('node:fs', { spy: true });
const readFileSyncMock = vi.mocked(readFileSync);
const existsSyncMock = vi.mocked(existsSync);

describe('CLASS: JsPackageManagerFactory', () => {
  beforeEach(() => {
    JsPackageManagerFactory.clearCache();
    findMock.up.mockReturnValue(undefined);
    findMock.any.mockReturnValue(undefined);
    walkMock.up.mockReturnValue([]);
    getProjectRootMock.mockReturnValue(process.cwd());
    existsSyncMock.mockReturnValue(false);
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
          return undefined;
        });

        const cwd = process.cwd();
        walkMock.up.mockReturnValue([cwd]);
        existsSyncMock.mockImplementation((p) => {
          if (p === join(cwd, 'package.json')) {
            return true;
          }
          return false;
        });

        readFileSyncMock.mockImplementation((filePath, encoding) => {
          if (
            typeof filePath === 'string' &&
            filePath === join(cwd, 'package.json') &&
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
          return undefined;
        });

        const cwd = process.cwd();
        walkMock.up.mockReturnValue([cwd]);
        existsSyncMock.mockImplementation((p) => {
          if (p === join(cwd, 'package.json')) {
            return true;
          }
          return false;
        });

        readFileSyncMock.mockImplementation((filePath, encoding) => {
          if (
            typeof filePath === 'string' &&
            filePath === join(cwd, 'package.json') &&
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

  describe('getYarnVersionFromPackageJson walks upward', () => {
    /**
     * Helper: set up yarn.lock detection and a yarn --version that reports 1.x
     * so getYarnVersion falls through to getYarnVersionFromPackageJson first.
     */
    function setupYarnScenario() {
      executeCommandSyncMock.mockImplementation((options) => {
        if (options.command === 'yarn' && options.args?.[0] === '--version') {
          return '1.22.4';
        }
        throw new Error('Command not found');
      });
      findMock.up.mockImplementation((filename) => {
        if (typeof filename === 'string' && filename === 'yarn.lock') {
          return '/repo/yarn.lock';
        }
        return undefined;
      });
    }

    it('walks past a workspace package.json without packageManager to find root packageManager', () => {
      setupYarnScenario();
      getProjectRootMock.mockReturnValue('/repo');

      // walk.up returns directories from cwd upward to root
      walkMock.up.mockReturnValue(['/repo/packages/my-app', '/repo/packages', '/repo']);

      existsSyncMock.mockImplementation((p) => {
        if (p === join('/repo/packages/my-app', 'package.json')) {
          return true;
        }
        if (p === join('/repo', 'package.json')) {
          return true;
        }
        return false;
      });

      readFileSyncMock.mockImplementation((filePath, encoding) => {
        if (filePath === join('/repo/packages/my-app', 'package.json') && encoding === 'utf-8') {
          return JSON.stringify({ name: 'my-app', version: '1.0.0' });
        }
        if (filePath === join('/repo', 'package.json') && encoding === 'utf-8') {
          return JSON.stringify({ packageManager: 'yarn@4.1.0' });
        }
        throw new Error('File not found');
      });

      const cwd = '/repo/packages/my-app';
      expect(JsPackageManagerFactory.getPackageManager({}, cwd)).toBeInstanceOf(Yarn2Proxy);
    });

    it('uses getProjectRoot() as the starting context for the walk', () => {
      setupYarnScenario();
      getProjectRootMock.mockReturnValue('/custom-root');

      walkMock.up.mockReturnValue([
        '/custom-root/packages/app',
        '/custom-root/packages',
        '/custom-root',
      ]);

      existsSyncMock.mockImplementation((p) => {
        if (p === join('/custom-root', 'package.json')) {
          return true;
        }
        return false;
      });

      readFileSyncMock.mockImplementation((filePath, encoding) => {
        if (filePath === join('/custom-root', 'package.json') && encoding === 'utf-8') {
          return JSON.stringify({ packageManager: 'yarn@4.1.0' });
        }
        throw new Error('File not found');
      });

      const cwd = '/custom-root/packages/app';
      expect(JsPackageManagerFactory.getPackageManager({}, cwd)).toBeInstanceOf(Yarn2Proxy);
      // Verify walk.up was called with the project root as the `last` boundary
      expect(walkMock.up).toHaveBeenCalledWith(cwd, { last: '/custom-root' });
    });

    it('falls back to cwd when getProjectRoot returns cwd', () => {
      setupYarnScenario();
      const cwd = '/some/project';
      getProjectRootMock.mockReturnValue(cwd);

      walkMock.up.mockReturnValue([cwd]);

      existsSyncMock.mockImplementation((p) => {
        if (p === join(cwd, 'package.json')) {
          return true;
        }
        return false;
      });

      readFileSyncMock.mockImplementation((filePath, encoding) => {
        if (filePath === join(cwd, 'package.json') && encoding === 'utf-8') {
          return JSON.stringify({ packageManager: 'yarn@1.22.0' });
        }
        throw new Error('File not found');
      });

      expect(JsPackageManagerFactory.getPackageManager({}, cwd)).toBeInstanceOf(Yarn1Proxy);
    });

    it('prefers the closest package.json that declares packageManager', () => {
      setupYarnScenario();
      getProjectRootMock.mockReturnValue('/repo');

      walkMock.up.mockReturnValue(['/repo/packages/my-app', '/repo/packages', '/repo']);

      existsSyncMock.mockImplementation((p) => {
        if (p === join('/repo/packages/my-app', 'package.json')) {
          return true;
        }
        if (p === join('/repo', 'package.json')) {
          return true;
        }
        return false;
      });

      readFileSyncMock.mockImplementation((filePath, encoding) => {
        // Closest has yarn@1 packageManager
        if (filePath === join('/repo/packages/my-app', 'package.json') && encoding === 'utf-8') {
          return JSON.stringify({ packageManager: 'yarn@1.22.0' });
        }
        // Root has yarn@4 packageManager
        if (filePath === join('/repo', 'package.json') && encoding === 'utf-8') {
          return JSON.stringify({ packageManager: 'yarn@4.1.0' });
        }
        throw new Error('File not found');
      });

      const cwd = '/repo/packages/my-app';
      // Should pick up the closest one (yarn@1)
      expect(JsPackageManagerFactory.getPackageManager({}, cwd)).toBeInstanceOf(Yarn1Proxy);
    });

    it('returns undefined when no package.json in any ancestor declares packageManager', () => {
      setupYarnScenario();
      getProjectRootMock.mockReturnValue('/repo');

      walkMock.up.mockReturnValue(['/repo/packages/my-app', '/repo']);

      existsSyncMock.mockImplementation((p) => {
        if (p === join('/repo/packages/my-app', 'package.json')) {
          return true;
        }
        if (p === join('/repo', 'package.json')) {
          return true;
        }
        return false;
      });

      readFileSyncMock.mockImplementation((filePath, encoding) => {
        if (filePath === join('/repo/packages/my-app', 'package.json') && encoding === 'utf-8') {
          return JSON.stringify({ name: 'my-app' });
        }
        if (filePath === join('/repo', 'package.json') && encoding === 'utf-8') {
          return JSON.stringify({ name: 'monorepo' });
        }
        throw new Error('File not found');
      });

      const cwd = '/repo/packages/my-app';
      // No packageManager anywhere, yarn --version reports 1.x, no .yarnrc.yml → Yarn1
      expect(JsPackageManagerFactory.getPackageManager({}, cwd)).toBeInstanceOf(Yarn1Proxy);
    });

    it('skips unparsable package.json files and continues walking', () => {
      setupYarnScenario();
      getProjectRootMock.mockReturnValue('/repo');

      walkMock.up.mockReturnValue(['/repo/packages/broken', '/repo']);

      existsSyncMock.mockImplementation((p) => {
        if (p === join('/repo/packages/broken', 'package.json')) {
          return true;
        }
        if (p === join('/repo', 'package.json')) {
          return true;
        }
        return false;
      });

      readFileSyncMock.mockImplementation((filePath, encoding) => {
        if (filePath === join('/repo/packages/broken', 'package.json') && encoding === 'utf-8') {
          return '{ invalid json';
        }
        if (filePath === join('/repo', 'package.json') && encoding === 'utf-8') {
          return JSON.stringify({ packageManager: 'yarn@4.1.0' });
        }
        throw new Error('File not found');
      });

      const cwd = '/repo/packages/broken';
      expect(JsPackageManagerFactory.getPackageManager({}, cwd)).toBeInstanceOf(Yarn2Proxy);
    });
  });
});
