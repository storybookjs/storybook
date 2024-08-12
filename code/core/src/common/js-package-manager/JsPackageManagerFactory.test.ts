import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sync as spawnSync } from 'cross-spawn';
import { findUpSync } from 'find-up';

import { JsPackageManagerFactory } from './JsPackageManagerFactory';
import { NPMProxy } from './NPMProxy';
import { PNPMProxy } from './PNPMProxy';
import { Yarn1Proxy } from './Yarn1Proxy';
import { Yarn2Proxy } from './Yarn2Proxy';

vi.mock('cross-spawn');
const spawnSyncMock = vi.mocked(spawnSync);

vi.mock('find-up');
const findUpSyncMock = vi.mocked(findUpSync);

describe('CLASS: JsPackageManagerFactory', () => {
  beforeEach(() => {
    findUpSyncMock.mockReturnValue(undefined);
    spawnSyncMock.mockReturnValue({ status: 1 } as any);
    delete process.env.npm_config_user_agent;
  });

  describe('METHOD: getPackageManager', () => {
    describe('NPM proxy', () => {
      it('FORCE: it should return a NPM proxy when `force` option is `npm`', () => {
        expect(JsPackageManagerFactory.getPackageManager({ force: 'npm' })).toBeInstanceOf(
          NPMProxy
        );
      });

      it('USER AGENT: it should infer npm from the user agent', () => {
        process.env.npm_config_user_agent = 'npm/7.24.0';
        expect(JsPackageManagerFactory.getPackageManager()).toBeInstanceOf(NPMProxy);
      });

      it('ALL EXIST: when all package managers are ok, but only a `package-lock.json` file is found', () => {
        spawnSyncMock.mockImplementation((command) => {
          // Yarn is ok
          if (command === 'yarn') {
            return {
              status: 0,
              output: '1.22.4',
            };
          }
          // NPM is ok
          if (command === 'npm') {
            return {
              status: 0,
              output: '6.5.12',
            };
          }
          // PNPM is ok
          if (command === 'pnpm') {
            return {
              status: 0,
              output: '7.9.5',
            };
          }
          // Unknown package manager is ko
          return {
            status: 1,
          } as any;
        });

        // There is only a package-lock.json
        findUpSyncMock.mockImplementation(() => '/Users/johndoe/Documents/package-lock.json');

        expect(JsPackageManagerFactory.getPackageManager()).toBeInstanceOf(NPMProxy);
      });
    });

    describe('PNPM proxy', () => {
      it('FORCE: it should return a PNPM proxy when `force` option is `pnpm`', () => {
        expect(JsPackageManagerFactory.getPackageManager({ force: 'pnpm' })).toBeInstanceOf(
          PNPMProxy
        );
      });

      it('USER AGENT: it should infer pnpm from the user agent', () => {
        process.env.npm_config_user_agent = 'pnpm/7.4.0';
        expect(JsPackageManagerFactory.getPackageManager()).toBeInstanceOf(PNPMProxy);
      });

      it('ALL EXIST: when all package managers are ok, but only a `pnpm-lock.yaml` file is found', () => {
        spawnSyncMock.mockImplementation((command) => {
          // Yarn is ok
          if (command === 'yarn') {
            return {
              status: 0,
              output: '1.22.4',
            };
          }
          // NPM is ok
          if (command === 'npm') {
            return {
              status: 0,
              output: '6.5.12',
            };
          }
          // PNPM is ok
          if (command === 'pnpm') {
            return {
              status: 0,
              output: '7.9.5',
            };
          }
          // Unknown package manager is ko
          return {
            status: 1,
          } as any as any;
        });

        // There is only a pnpm-lock.yaml
        findUpSyncMock.mockImplementation(() => '/Users/johndoe/Documents/pnpm-lock.yaml');

        expect(JsPackageManagerFactory.getPackageManager()).toBeInstanceOf(PNPMProxy);
      });

      it('PNPM LOCK IF CLOSER: when a pnpm-lock.yaml file is closer than a yarn.lock', async () => {
        // Allow find-up to work as normal, we'll set the cwd to our fixture package
        findUpSyncMock.mockImplementation(
          (await vi.importActual<typeof import('find-up')>('find-up')).findUpSync
        );

        spawnSyncMock.mockImplementation((command) => {
          // Yarn is ok
          if (command === 'yarn') {
            return {
              status: 0,
              output: '1.22.4',
            };
          }
          // NPM is ok
          if (command === 'npm') {
            return {
              status: 0,
              output: '6.5.12',
            };
          }
          // PNPM is ok
          if (command === 'pnpm') {
            return {
              status: 0,
              output: '7.9.5',
            };
          }
          // Unknown package manager is ko
          return {
            status: 1,
          } as any;
        });
        const fixture = join(__dirname, 'fixtures', 'pnpm-workspace', 'package');
        expect(JsPackageManagerFactory.getPackageManager({}, fixture)).toBeInstanceOf(PNPMProxy);
      });
    });

    describe('Yarn 1 proxy', () => {
      it('FORCE: it should return a Yarn1 proxy when `force` option is `yarn1`', () => {
        expect(JsPackageManagerFactory.getPackageManager({ force: 'yarn1' })).toBeInstanceOf(
          Yarn1Proxy
        );
      });

      it('USER AGENT: it should infer yarn1 from the user agent', () => {
        process.env.npm_config_user_agent = 'yarn/1.22.11';
        expect(JsPackageManagerFactory.getPackageManager()).toBeInstanceOf(Yarn1Proxy);
      });

      it('when Yarn command is ok, Yarn version is <2, NPM is ko, PNPM is ko', () => {
        spawnSyncMock.mockImplementation((command) => {
          // Yarn is ok
          if (command === 'yarn') {
            return {
              status: 0,
              output: '1.22.4',
            };
          }
          // NPM is ko
          if (command === 'npm') {
            return {
              status: 1,
            };
          }
          // PNPM is ko
          if (command === 'pnpm') {
            return {
              status: 1,
            };
          }
          // Unknown package manager is ko
          return {
            status: 1,
          } as any;
        });

        // there is no lockfile
        findUpSyncMock.mockReturnValue(undefined);

        expect(JsPackageManagerFactory.getPackageManager()).toBeInstanceOf(Yarn1Proxy);
      });

      it('when Yarn command is ok, Yarn version is <2, NPM and PNPM are ok, there is a `yarn.lock` file', () => {
        spawnSyncMock.mockImplementation((command) => {
          // Yarn is ok
          if (command === 'yarn') {
            return {
              status: 0,
              output: '1.22.4',
            };
          }
          // NPM is ok
          if (command === 'npm') {
            return {
              status: 0,
              output: '6.5.12',
            };
          }
          // PNPM is ok
          if (command === 'pnpm') {
            return {
              status: 0,
              output: '7.9.5',
            };
          }
          // Unknown package manager is ko
          return {
            status: 1,
          } as any;
        });

        // There is a yarn.lock
        findUpSyncMock.mockImplementation(() => '/Users/johndoe/Documents/yarn.lock');

        expect(JsPackageManagerFactory.getPackageManager()).toBeInstanceOf(Yarn1Proxy);
      });

      it('when multiple lockfiles are in a project, prefers yarn', async () => {
        // Allow find-up to work as normal, we'll set the cwd to our fixture package
        findUpSyncMock.mockImplementation(
          (await vi.importActual<typeof import('find-up')>('find-up')).findUpSync
        );

        spawnSyncMock.mockImplementation((command) => {
          // Yarn is ok
          if (command === 'yarn') {
            return {
              status: 0,
              output: '1.22.4',
            };
          }
          // NPM is ok
          if (command === 'npm') {
            return {
              status: 0,
              output: '6.5.12',
            };
          }
          // PNPM is ok
          if (command === 'pnpm') {
            return {
              status: 0,
              output: '7.9.5',
            };
          }
          // Unknown package manager is ko
          return {
            status: 1,
          } as any;
        });
        const fixture = join(__dirname, 'fixtures', 'multiple-lockfiles');
        expect(JsPackageManagerFactory.getPackageManager({}, fixture)).toBeInstanceOf(Yarn1Proxy);
      });
    });

    describe('Yarn 2 proxy', () => {
      it('FORCE: it should return a Yarn2 proxy when `force` option is `yarn2`', () => {
        expect(JsPackageManagerFactory.getPackageManager({ force: 'yarn2' })).toBeInstanceOf(
          Yarn2Proxy
        );
      });

      it('USER AGENT: it should infer yarn2 from the user agent', () => {
        process.env.npm_config_user_agent = 'yarn/2.2.10';
        expect(JsPackageManagerFactory.getPackageManager()).toBeInstanceOf(Yarn2Proxy);
      });

      it('ONLY YARN 2: when Yarn command is ok, Yarn version is >=2, NPM is ko, PNPM is ko', () => {
        spawnSyncMock.mockImplementation((command) => {
          // Yarn is ok
          if (command === 'yarn') {
            return {
              status: 0,
              output: '2.0.0-rc.33',
            };
          }
          // NPM is ko
          if (command === 'npm') {
            return {
              status: 1,
            };
          }
          // PNPM is ko
          if (command === 'pnpm') {
            return {
              status: 1,
            };
          }
          // Unknown package manager is ko
          return {
            status: 1,
          } as any;
        });

        expect(JsPackageManagerFactory.getPackageManager()).toBeInstanceOf(Yarn2Proxy);
      });

      it('when Yarn command is ok, Yarn version is >=2, NPM and PNPM are ok, there is a `yarn.lock` file', () => {
        spawnSyncMock.mockImplementation((command) => {
          // Yarn is ok
          if (command === 'yarn') {
            return {
              status: 0,
              output: '2.0.0-rc.33',
            };
          }
          // NPM is ok
          if (command === 'npm') {
            return {
              status: 0,
              output: '6.5.12',
            };
          }
          // PNPM is ok
          if (command === 'pnpm') {
            return {
              status: 0,
              output: '7.9.5',
            };
          }
          // Unknown package manager is ko
          return {
            status: 1,
          } as any;
        });

        // There is a yarn.lock
        findUpSyncMock.mockImplementation(() => '/Users/johndoe/Documents/yarn.lock');

        expect(JsPackageManagerFactory.getPackageManager()).toBeInstanceOf(Yarn2Proxy);
      });
    });

    it('throws an error if Yarn, NPM, and PNPM are not found', () => {
      spawnSyncMock.mockReturnValue({ status: 1 } as any);
      expect(() => JsPackageManagerFactory.getPackageManager()).toThrow();
    });
  });
});
