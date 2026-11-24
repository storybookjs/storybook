import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from '../js-package-manager/JsPackageManager.ts';
import { addReactDocgenFallback } from './typescript-7-react-docgen-fallback.ts';

describe('addReactDocgenFallback', () => {
  let packageJson: Record<string, unknown>;
  let packageManager: JsPackageManager;

  beforeEach(() => {
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
});
