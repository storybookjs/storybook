import * as fs from 'node:fs';
import { pathToFileURL } from 'node:url';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as find from 'empathic/find';
import { fs as memfs, vol } from 'memfs';

import { PackageManagerName } from '../js-package-manager/JsPackageManager.ts';
import {
  findPackageManagerForInstallHint,
  getAddDevDependenciesCommand,
  isPackageInstalledInRange,
  isPnpmWorkspaceRoot,
} from './builder-docgen-packages.ts';

vi.mock('node:fs', { spy: true });
vi.mock('empathic/find', { spy: true });

/** Files that `find.up` sees, by absolute path. */
let existingFiles: string[] = [];

beforeEach(() => {
  vol.reset();
  existingFiles = [];
  vi.mocked(fs.readFileSync).mockImplementation(memfs.readFileSync as typeof fs.readFileSync);
  vi.mocked(find.up).mockImplementation((name, { cwd = '/' } = {}) => {
    for (let dir = cwd; ; dir = dir.slice(0, dir.lastIndexOf('/')) || '/') {
      const candidate = `${dir === '/' ? '' : dir}/${name}`;
      if (existingFiles.includes(candidate)) {
        return candidate;
      }
      if (dir === '/') {
        return undefined;
      }
    }
  });
});

describe('getAddDevDependenciesCommand', () => {
  it.each([
    [PackageManagerName.NPM, 'npm install -D "react-docgen@^8.0.2"'],
    [PackageManagerName.YARN2, 'yarn add -D "react-docgen@^8.0.2"'],
    [PackageManagerName.PNPM, 'pnpm add -D "react-docgen@^8.0.2"'],
    [PackageManagerName.BUN, 'bun add -D "react-docgen@^8.0.2"'],
  ])('builds the %s command', (packageManager, command) => {
    expect(getAddDevDependenciesCommand({ 'react-docgen': '^8.0.2' }, packageManager)).toBe(
      command
    );
  });

  it('installs the newest alternative of a range', () => {
    expect(
      getAddDevDependenciesCommand({ plugin: '^0.7.0 || ^0.9.0' }, PackageManagerName.NPM)
    ).toBe('npm install -D "plugin@^0.9.0"');
  });

  it('leaves a specifier without range characters unquoted', () => {
    expect(
      getAddDevDependenciesCommand({ plugin: '1.0.6--canary.9.0c3f3b7.0' }, PackageManagerName.NPM)
    ).toBe('npm install -D plugin@1.0.6--canary.9.0c3f3b7.0');
  });
});

describe('findPackageManagerForInstallHint', () => {
  it('uses the closest lockfile', () => {
    existingFiles = ['/repo/yarn.lock', '/repo/apps/web/pnpm-lock.yaml'];

    expect(
      findPackageManagerForInstallHint({ cwd: '/repo/apps/web', last: '/repo', userAgent: '' })
    ).toBe(PackageManagerName.PNPM);
  });

  it('falls back to the user agent, then to npm', () => {
    expect(
      findPackageManagerForInstallHint({ cwd: '/repo', last: '/repo', userAgent: 'pnpm/10.0.0' })
    ).toBe(PackageManagerName.PNPM);
    expect(findPackageManagerForInstallHint({ cwd: '/repo', last: '/repo', userAgent: '' })).toBe(
      PackageManagerName.NPM
    );
  });
});

describe('isPnpmWorkspaceRoot', () => {
  beforeEach(() => {
    existingFiles = [
      '/repo/pnpm-workspace.yaml',
      '/repo/package.json',
      '/repo/apps/web/package.json',
    ];
  });

  it('is true only in the package at the workspace root', () => {
    expect(isPnpmWorkspaceRoot('/repo')).toBe(true);
    expect(isPnpmWorkspaceRoot('/repo/apps/web')).toBe(false);
  });
});

describe('isPackageInstalledInRange', () => {
  const resolve = (specifier: string) =>
    pathToFileURL(`/project/node_modules/${specifier}/dist/main.js`).href;

  const installReactDocgen = (version: string) =>
    vol.fromNestedJSON({
      '/project/node_modules/react-docgen/package.json': JSON.stringify({
        name: 'react-docgen',
        version,
      }),
    });

  it('accepts a version in the range', () => {
    installReactDocgen('8.0.4');

    expect(isPackageInstalledInRange(resolve, 'react-docgen', '^8.0.2')).toBe(true);
  });

  it('rejects an older major that another dependency hoisted', () => {
    installReactDocgen('5.4.3');

    expect(isPackageInstalledInRange(resolve, 'react-docgen', '^8.0.2')).toBe(false);
  });

  it('rejects a package that does not resolve', () => {
    const resolveMissing = () => {
      throw Object.assign(new Error("Cannot find package 'react-docgen'"), {
        code: 'ERR_MODULE_NOT_FOUND',
      });
    };

    expect(isPackageInstalledInRange(resolveMissing, 'react-docgen', '^8.0.2')).toBe(false);
  });
});
