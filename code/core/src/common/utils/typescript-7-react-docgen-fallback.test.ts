import * as fs from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as pkg from 'empathic/package';
import { fs as memfs, vol } from 'memfs';

import type { JsPackageManager } from '../js-package-manager/JsPackageManager.ts';
import {
  addReactDocgenFallback,
  readTemporaryDependencies,
} from './typescript-7-react-docgen-fallback.ts';

// TEMPORARY(ts-7.1): delete together with `typescript-7-react-docgen-fallback.ts`.

vi.mock('node:fs', { spy: true });
vi.mock('empathic/package', { spy: true });

const RECORD = '/project/node_modules/.cache/storybook/temporary-dependencies.json';

describe('addReactDocgenFallback', () => {
  let packageJson: Record<string, unknown>;
  let packageManager: JsPackageManager;

  beforeEach(() => {
    vol.reset();
    vi.mocked(fs.readFileSync).mockImplementation(memfs.readFileSync as typeof fs.readFileSync);
    vi.mocked(fs.writeFileSync).mockImplementation(memfs.writeFileSync as typeof fs.writeFileSync);
    vi.mocked(fs.mkdirSync).mockImplementation(memfs.mkdirSync as typeof fs.mkdirSync);
    vi.mocked(pkg.cache).mockReturnValue('/project/node_modules/.cache/storybook');
    packageJson = { devDependencies: { typescript: '~7.0.2' } };
    packageManager = {
      primaryPackageJson: { packageJson, operationDir: '/project' },
      writePackageJson: vi.fn(),
    } as unknown as JsPackageManager;
  });

  it('adds react-docgen to devDependencies', () => {
    addReactDocgenFallback(packageManager);

    expect(packageJson).toEqual({
      devDependencies: { typescript: '~7.0.2', 'react-docgen': '^8.0.2' },
    });
    expect(packageManager.writePackageJson).toHaveBeenCalledExactlyOnceWith(
      packageJson,
      '/project'
    );
  });

  it('records it in the unversioned Storybook cache, next to earlier records', () => {
    vol.fromNestedJSON({ [RECORD]: JSON.stringify({ other: 'some-reason' }) });

    addReactDocgenFallback(packageManager);

    expect(readTemporaryDependencies('/project')).toEqual({
      other: 'some-reason',
      'react-docgen': 'typescript-7.0-docgen-fallback',
    });
  });

  describe('when the cache cannot be written', () => {
    beforeEach(() => {
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error('EACCES');
      });
    });

    it('still adds react-docgen, which the TypeScript 7.1 automigration then keeps', () => {
      expect(() => addReactDocgenFallback(packageManager)).not.toThrow();
      expect(packageManager.writePackageJson).toHaveBeenCalledOnce();
      expect(readTemporaryDependencies('/project')).toEqual({});
    });
  });
});
