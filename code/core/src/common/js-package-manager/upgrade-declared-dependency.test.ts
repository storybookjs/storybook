import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fs, vol } from 'memfs';

import { JsPackageManager } from './JsPackageManager.ts';

vi.mock('node:fs', { spy: true });

const ROOT = resolve('/project/package.json');
const STORYBOOK = resolve('/project/storybook/package.json');
const COMPONENTS = resolve('/project/components/package.json');

const write = (path: string, packageJson: object) =>
  vol.fromJSON({ [path]: `${JSON.stringify(packageJson, null, 2)}\n` });
const read = (path: string) => JSON.parse(String(fs.readFileSync(path, 'utf8')));

describe('upgradeDeclaredDependency', () => {
  const create = (packageJsonPaths: string[], primary = packageJsonPaths[0]) => {
    // @ts-expect-error Ignore abstract class error
    const packageManager: JsPackageManager = new JsPackageManager({ cwd: resolve('/project') });
    packageManager.packageJsonPaths = packageJsonPaths;
    Object.assign(packageManager, {
      primaryPackageJson: JsPackageManager.getPackageJsonInfo(primary),
    });
    return packageManager;
  };

  beforeEach(() => {
    vol.reset();
    JsPackageManager.packageJsonCache.clear();
    vi.mocked(readFileSync).mockImplementation(fs.readFileSync as typeof readFileSync);
    vi.mocked(writeFileSync).mockImplementation(fs.writeFileSync as typeof writeFileSync);
  });

  it('upgrades the dependency in every package.json that declares it, in the same field', () => {
    write(ROOT, { devDependencies: { typescript: '~7.0.2' } });
    write(STORYBOOK, { devDependencies: { storybook: '^11.0.0' } });
    write(COMPONENTS, { dependencies: { typescript: '7.0.2' } });

    create([STORYBOOK, ROOT, COMPONENTS]).upgradeDeclaredDependency('typescript@^7.1', '7.0.2');

    expect(read(ROOT)).toEqual({ devDependencies: { typescript: '^7.1' } });
    expect(read(STORYBOOK)).toEqual({ devDependencies: { storybook: '^11.0.0' } });
    expect(read(COMPONENTS)).toEqual({ dependencies: { typescript: '^7.1' } });
  });

  it('leaves a declaration that the installed version does not satisfy alone', () => {
    write(ROOT, { devDependencies: { typescript: '^6.0.3' } });
    write(STORYBOOK, { devDependencies: { storybook: '^11.0.0', typescript: '~7.0.2' } });

    create([STORYBOOK, ROOT]).upgradeDeclaredDependency('typescript@^7.1', '7.0.2');

    expect(read(ROOT)).toEqual({ devDependencies: { typescript: '^6.0.3' } });
    expect(read(STORYBOOK)).toEqual({
      devDependencies: { storybook: '^11.0.0', typescript: '^7.1' },
    });
  });

  it('leaves a peer dependency range alone', () => {
    write(COMPONENTS, {
      devDependencies: { typescript: '~7.0.2' },
      peerDependencies: { typescript: '>=5.9' },
    });

    create([COMPONENTS]).upgradeDeclaredDependency('typescript@^7.1', '7.0.2');

    expect(read(COMPONENTS)).toEqual({
      devDependencies: { typescript: '^7.1' },
      peerDependencies: { typescript: '>=5.9' },
    });
  });

  it('adds the dependency to the primary package.json when no package.json declares it', () => {
    write(ROOT, { private: true });
    write(STORYBOOK, { devDependencies: { storybook: '^11.0.0' } });

    create([STORYBOOK, ROOT]).upgradeDeclaredDependency('typescript@^7.1', '7.0.2');

    expect(read(ROOT)).toEqual({ private: true });
    expect(read(STORYBOOK)).toEqual({
      devDependencies: { storybook: '^11.0.0', typescript: '^7.1' },
    });
  });
});
