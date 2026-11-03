import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from '../js-package-manager/JsPackageManager.ts';
import { addReactDocgenFallback } from './typescript-7-react-docgen-fallback.ts';

// TEMPORARY(ts-7.1): delete together with `typescript-7-react-docgen-fallback.ts`.

const packageManagerWith = (packageJson: Record<string, unknown>) =>
  ({
    primaryPackageJson: { packageJson, operationDir: '/project' },
    writePackageJson: vi.fn(),
  }) as unknown as JsPackageManager;

describe('addReactDocgenFallback', () => {
  let packageJson: Record<string, unknown>;

  beforeEach(() => {
    packageJson = {
      devDependencies: { typescript: '~7.0.2' },
      storybook: { url: 'https://example.com/storybook' },
    };
  });

  it('adds react-docgen and records why, in one write', () => {
    const packageManager = packageManagerWith(packageJson);

    expect(addReactDocgenFallback(packageManager)).toBe(true);
    expect(packageManager.writePackageJson).toHaveBeenCalledOnce();
    expect(packageJson).toEqual({
      devDependencies: { typescript: '~7.0.2', 'react-docgen': '^8.0.2' },
      storybook: {
        url: 'https://example.com/storybook',
        temporaryDependencies: { 'react-docgen': 'typescript-7.0-docgen-fallback' },
      },
    });
  });

  describe('when the storybook field is not an object', () => {
    beforeEach(() => {
      packageJson = { devDependencies: { typescript: '~7.0.2' }, storybook: 'see docs' };
    });

    it('adds nothing, so react-docgen never exists without its record', () => {
      const packageManager = packageManagerWith(packageJson);

      expect(addReactDocgenFallback(packageManager)).toBe(false);
      expect(packageManager.writePackageJson).not.toHaveBeenCalled();
      expect(packageJson).toEqual({
        devDependencies: { typescript: '~7.0.2' },
        storybook: 'see docs',
      });
    });
  });
});
