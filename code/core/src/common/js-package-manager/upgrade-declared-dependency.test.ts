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
  const create = (packageJsonPaths: string[]) => {
    // @ts-expect-error Ignore abstract class error
    const packageManager: JsPackageManager = new JsPackageManager({ cwd: resolve('/project') });
    packageManager.packageJsonPaths = packageJsonPaths;
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

    create([STORYBOOK, ROOT, COMPONENTS]).upgradeDeclaredDependency('typescript@^7.1');

    expect(read(ROOT)).toEqual({ devDependencies: { typescript: '^7.1' } });
    expect(read(STORYBOOK)).toEqual({ devDependencies: { storybook: '^11.0.0' } });
    expect(read(COMPONENTS)).toEqual({ dependencies: { typescript: '^7.1' } });
  });

  it('leaves a peer dependency range alone', () => {
    write(COMPONENTS, {
      devDependencies: { typescript: '~7.0.2' },
      peerDependencies: { typescript: '>=5.9' },
    });

    create([COMPONENTS]).upgradeDeclaredDependency('typescript@^7.1');

    expect(read(COMPONENTS)).toEqual({
      devDependencies: { typescript: '^7.1' },
      peerDependencies: { typescript: '>=5.9' },
    });
  });

  it('does not add the dependency to a package.json without it', () => {
    write(STORYBOOK, { devDependencies: { storybook: '^11.0.0' } });

    create([STORYBOOK]).upgradeDeclaredDependency('typescript@^7.1');

    expect(read(STORYBOOK)).toEqual({ devDependencies: { storybook: '^11.0.0' } });
  });
});
