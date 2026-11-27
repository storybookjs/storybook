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

describe('replaceDependency', () => {
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

  it('replaces the dependency in every package.json that lists it, in the same field', () => {
    write(ROOT, { name: 'root', devDependencies: { prettier: '^3.0.0' } });
    write(STORYBOOK, { devDependencies: { storybook: '^11.0.0', addon: '5.1.2' } });
    write(COMPONENTS, { dependencies: { addon: '^5.1.2', svelte: '^5.0.0' } });

    const changed = create([ROOT, STORYBOOK, COMPONENTS]).replaceDependency(
      'addon',
      '@storybook/svelte-vite',
      '^11.0.1'
    );

    expect(changed).toEqual([STORYBOOK, COMPONENTS]);
    expect(read(ROOT)).toEqual({ name: 'root', devDependencies: { prettier: '^3.0.0' } });
    expect(read(STORYBOOK).devDependencies).toEqual({
      storybook: '^11.0.0',
      '@storybook/svelte-vite': '^11.0.0',
    });
    expect(read(COMPONENTS).dependencies).toEqual({
      svelte: '^5.0.0',
      '@storybook/svelte-vite': '^11.0.1',
    });
  });

  it('only removes the dependency where the package.json already declares the replacement', () => {
    write(STORYBOOK, {
      dependencies: { '@storybook/svelte-vite': '~11.0.0' },
      devDependencies: { addon: '5.1.2' },
    });

    create([STORYBOOK]).replaceDependency('addon', '@storybook/svelte-vite', '^11.0.1');

    expect(read(STORYBOOK)).toEqual({ dependencies: { '@storybook/svelte-vite': '~11.0.0' } });
  });

  it.each(['catalog:', 'workspace:*'])(
    'uses the given version when storybook is declared as %s',
    (specifier) => {
      write(STORYBOOK, { devDependencies: { storybook: specifier, addon: '5.1.2' } });

      create([STORYBOOK]).replaceDependency('addon', '@storybook/svelte-vite', '^11.0.1');

      expect(read(STORYBOOK).devDependencies).toEqual({
        storybook: specifier,
        '@storybook/svelte-vite': '^11.0.1',
      });
    }
  );

  it('changes nothing when no package.json lists the dependency', () => {
    write(STORYBOOK, { devDependencies: { storybook: '^11.0.0' } });

    expect(
      create([STORYBOOK]).replaceDependency('addon', '@storybook/svelte-vite', '^11.0.1')
    ).toEqual([]);
    expect(read(STORYBOOK)).toEqual({ devDependencies: { storybook: '^11.0.0' } });
  });
});
